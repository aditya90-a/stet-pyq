"""Stage 5: data-integrity checks.  Every finding is reported; nothing is silently dropped."""
from __future__ import annotations

import re
from collections import Counter, defaultdict

from rapidfuzz import fuzz

from .normalize import norm

VISUAL_ORDER_LEFTOVER = re.compile(r"(?:^|\s)ि|([ा-ौ])\1")


def _issue(sev: str, code: str, msg: str, qid: str | None = None, paper: str | None = None) -> dict:
    return {"severity": sev, "code": code, "message": msg, "questionId": qid, "paperId": paper}


def run(questions: list[dict], papers: dict[str, dict], manifest: list[dict], rep: dict) -> list[dict]:
    out: list[dict] = []
    for e in manifest:
        if e.get("type") == "pdf" and e.get("status") != "ok":
            out.append(_issue("error", "pdf-not-processed", f"{e['name']}: {e.get('status')} {e.get('errors')}"))
        for p in e.get("emptyTextPages", []) or []:
            out.append(_issue("info", "page-without-text", f"{e['name']} page {p} has no text layer (cover/advert or scanned)"))

    by_paper = defaultdict(list)
    for q in questions:
        by_paper[q["paperId"]].append(q)
        qid = q["id"]
        if not q["text"].strip():
            out.append(_issue("error", "missing-text", "question text missing", qid, q["paperId"]))
        if q.get("textOrigin") != "pdf-text-layer":
            out.append(_issue("info", "text-transcribed", f"question text not from the PDF text layer ({q['textOrigin']})", qid, q["paperId"]))
        if len(q["options"]) != 4:
            out.append(_issue("error", "option-count", f"{len(q['options'])} options (expected 4)", qid, q["paperId"]))
        blanks = [o["label"] for o in q["options"] if not o["text"].strip()]
        if blanks:
            out.append(_issue("warning", "blank-option", f"option(s) {','.join(blanks)} blank in source", qid, q["paperId"]))
        norms = [norm(o["text"]) for o in q["options"] if o["text"].strip()]
        if len(set(norms)) < len(norms):
            out.append(_issue("warning", "duplicate-options", "two options have identical text", qid, q["paperId"]))
        a = q["answer"]
        if a["index"] is None:
            out.append(_issue("warning", "no-key", "no answer key in source", qid, q["paperId"]))
        elif a["index"] >= len(q["options"]):
            out.append(_issue("error", "key-out-of-range", "answer index outside options", qid, q["paperId"]))
        elif a.get("textInSource"):
            keyed = norm(q["options"][a["index"]].get("textInSource") or q["options"][a["index"]]["text"])
            if fuzz.ratio(keyed, norm(a["textInSource"].split("\n")[0])) < 85 and fuzz.partial_ratio(keyed, norm(a["textInSource"])) < 90:
                out.append(_issue("warning", "key-text-mismatch", f"keyed option text differs from printed answer text '{a['textInSource'][:60]}'", qid, q["paperId"]))
        pages = papers[q["paperId"]]["pdf"]["pages"] or 0
        if not (1 <= q["source"]["page"] <= q["source"]["pageEnd"] <= pages):
            out.append(_issue("error", "bad-page", f"page reference {q['source']['page']}-{q['source']['pageEnd']} outside 1..{pages}", qid, q["paperId"]))
        hi = " ".join([q.get("textHi") or ""] + [o.get("textHi") or "" for o in q["options"]])
        if "�" in q["text"] + hi:
            out.append(_issue("error", "replacement-char", "text contains U+FFFD (corrupted characters)", qid, q["paperId"]))
        if hi.strip() and VISUAL_ORDER_LEFTOVER.search(hi):
            out.append(_issue("warning", "hindi-order", "Hindi text still shows visual-order artefacts after repair", qid, q["paperId"]))
        if q["hindiFixes"]:
            out.append(_issue("info", "hindi-repaired", f"Hindi text auto-repaired: {', '.join(q['hindiFixes'])}", qid, q["paperId"]))
        for msg in q["extractionIssues"]:
            out.append(_issue("warning", "extraction-note", msg, qid, q["paperId"]))
        if q.get("explanation") is None:
            out.append(_issue("info", "no-explanation", "no explanation available yet", qid, q["paperId"]))
        if q["classification"]["topic"] == "Unclassified":
            out.append(_issue("warning", "unclassified", "topic not classified", qid, q["paperId"]))

    for pid, qs in by_paper.items():
        nums = sorted(q["qno"] for q in qs)
        missing = sorted(set(range(1, max(nums) + 1)) - set(nums))
        if missing:
            out.append(_issue("error", "missing-question-numbers", f"missing question numbers {missing}", paper=pid))
        dup = [n for n, c in Counter(nums).items() if c > 1]
        if dup:
            out.append(_issue("error", "duplicate-question-numbers", f"duplicate numbers {dup}", paper=pid))
        sids = [q["sourceQuestionId"] for q in qs if q["sourceQuestionId"]]
        dsid = [s for s, c in Counter(sids).items() if c > 1]
        if dsid:
            out.append(_issue("warning", "duplicate-source-ids", f"duplicate source question ids {dsid}", paper=pid))
        if len(qs) != 150:
            out.append(_issue("warning", "question-count", f"{len(qs)} questions (all other papers have 150)", paper=pid))
        for c in papers[pid]["metaConflicts"]:
            out.append(_issue("warning", "metadata-conflict", c, paper=pid))

    for g in rep["groups"]["exact"]:
        if g["withinPaperDuplicates"]:
            out.append(_issue("warning", "within-paper-duplicate", f"group {g['id']} has two copies inside paper(s) {g['withinPaperDuplicates']}"))
    return out
