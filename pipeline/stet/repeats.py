"""Stage 3: repeated-question detection.

Every question is compared with every other question.  Four signals are combined:
  * character-level similarity of the normalised stem   (rapidfuzz ratio)
  * token-set similarity of the stem                    (rapidfuzz token_set_ratio)
  * TF-IDF cosine similarity of stem + options          (bag-of-words "semantic" proxy)
  * option-set and keyed-answer agreement

Classification (see `classify_pair`):
  exact       - same stem (>= 93 ratio, same numbers/literals) and same option set (>= 90)
  paraphrase  - same expected answer and a clearly equivalent question (rules below), or
                adjudicated as such by review
  concept     - different questions that test the same rule/principle (only from adjudication
                or matching concept annotations; never from keywords alone)
  review      - plausible pairs that the rules cannot decide automatically
Shared topic alone never creates a match.
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict

import numpy as np
from rapidfuzz import fuzz, process

from .normalize import norm, tokens

EXACT_STEM = 93
EXACT_OPTS = 90
REVIEW_MIN_COS = 0.42
REVIEW_MIN_TSET = 78


def literals(s: str) -> tuple[str, ...]:
    """Numbers and short symbolic literals that change the meaning of otherwise identical stems."""
    nums = re.findall(r"\d+(?:\.\d+)?", s)
    syms = re.findall(r"[{(\[][^{}()\[\]]{1,40}[})\]]", s)
    return tuple(nums) + tuple(sorted(set(norm(x) for x in syms)))


def option_similarity(a: list[str], b: list[str]) -> float:
    """Average best-match similarity between two option lists (order-independent), 0-100."""
    if not a or not b:
        return 0.0
    na, nb = [norm(x) for x in a], [norm(x) for x in b]
    m = process.cdist(na, nb, scorer=fuzz.ratio)
    return float((m.max(axis=1).mean() + m.max(axis=0).mean()) / 2)


def tfidf_matrix(docs: list[list[str]]) -> np.ndarray:
    df = Counter(t for d in docs for t in set(d))
    vocab = {t: i for i, t in enumerate(sorted(df))}
    n = len(docs)
    mat = np.zeros((n, len(vocab)), dtype=np.float32)
    for r, d in enumerate(docs):
        tf = Counter(d)
        for t, c in tf.items():
            mat[r, vocab[t]] = (1 + math.log(c)) * math.log((1 + n) / (1 + df[t]) + 1)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return mat / norms


def answer_text(q: dict) -> str | None:
    i = q.get("answerIndex")
    if i is None or i >= len(q["options"]):
        return None
    return q["options"][i]["text"]


def classify_pair(a: dict, b: dict, ratio: float, tset: float, cos: float) -> dict | None:
    opts_a = [o["text"] for o in a["options"]]
    opts_b = [o["text"] for o in b["options"]]
    osim = option_similarity(opts_a, opts_b)
    aa, ab = answer_text(a), answer_text(b)
    asim = fuzz.ratio(norm(aa), norm(ab)) if aa and ab else None
    same_literals = literals(a["text"]) == literals(b["text"])
    scores = {"stem": round(ratio, 1), "stemTokenSet": round(tset, 1), "cosine": round(cos, 3), "options": round(osim, 1), "answer": None if asim is None else round(asim, 1)}

    if ratio >= EXACT_STEM and osim >= EXACT_OPTS and same_literals:
        reason = "Identical or near-identical question wording and the same answer options"
        if asim is not None and asim < 85:
            reason += "; NOTE: the source keys mark different answers"
        return {"type": "exact", "method": "auto", "scores": scores, "reason": reason}

    answer_same = asim is not None and asim >= 88
    if answer_same and same_literals:
        if ratio >= EXACT_STEM and osim < EXACT_OPTS:
            return {"type": "paraphrase", "method": "auto", "scores": scores,
                    "reason": "Same question wording and same correct answer, but the distractor options differ"}
        if (ratio >= 82 or tset >= 90) and osim >= 70:
            return {"type": "paraphrase", "method": "auto", "scores": scores,
                    "reason": "Reworded question with largely the same options and the same correct answer"}

    if _candidate_mask(cos, ratio, tset):
        why = []
        if not same_literals:
            why.append("numbers/literals in the stem differ")
        if answer_same:
            why.append("same correct answer text")
        elif asim is not None:
            why.append("different correct answer")
        return {"type": "review", "method": "pending", "scores": scores,
                "reason": "Similar wording; needs review (" + ", ".join(why or ["borderline similarity"]) + ")"}
    return None


def _candidate_mask(cos, ratio, tset):
    """Pairs worth a closer look.  token_set_ratio alone is too permissive (short generic stems such as
    'Which of the following is a database?' are token subsets of many others), so it needs support."""
    support = cos >= 0.2
    return (cos >= REVIEW_MIN_COS) | ((tset >= REVIEW_MIN_TSET) & (ratio >= 60) & support) | ((ratio >= 75) & support)


def find_pairs(questions: list[dict]) -> list[dict]:
    stems = [norm(q["text"]) for q in questions]
    docs = [tokens(q["text"]) + tokens(" ".join(o["text"] for o in q["options"])) for q in questions]
    tf = tfidf_matrix(docs)
    cos = tf @ tf.T
    ratio = process.cdist(stems, stems, scorer=fuzz.ratio, workers=-1)
    tset = process.cdist(stems, stems, scorer=fuzz.token_set_ratio, workers=-1)
    pairs = []
    n = len(questions)
    for i in range(n):
        cand = np.where(_candidate_mask(cos[i, i + 1 :], ratio[i, i + 1 :], tset[i, i + 1 :]))[0] + i + 1
        for j in cand:
            a, b = questions[i], questions[j]
            if not stems[i] or not stems[j]:
                continue
            res = classify_pair(a, b, float(ratio[i, j]), float(tset[i, j]), float(cos[i, j]))
            if res:
                res.update({"a": a["id"], "b": b["id"]})
                pairs.append(res)
    return pairs


class UnionFind:
    def __init__(self):
        self.p: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.p.setdefault(x, x)
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[max(ra, rb)] = min(ra, rb)


def build_groups(pair_list: list[dict], types: set[str]) -> dict[str, list[str]]:
    uf = UnionFind()
    for p in pair_list:
        if p["type"] in types:
            uf.union(p["a"], p["b"])
    groups: dict[str, list[str]] = defaultdict(list)
    for x in list(uf.p):
        groups[uf.find(x)].append(x)
    return {k: sorted(v) for k, v in groups.items() if len(v) > 1}
