"""DSSSB-specific refinements on top of the shared repeat matcher (stet.repeats).

Two false-positive patterns in these papers:
  * long shared instructions ("In the following question below are given some statements followed by some
    conclusions ...") make different syllogism/reasoning questions look identical, and
  * figure questions ("By folding the given paper ...") share their words but differ in the picture.
An exact or paraphrase match is therefore kept only if the variable tail of the question also matches and,
when both questions carry figures, the figures look the same.
"""
from __future__ import annotations

import functools
import re
from pathlib import Path

from PIL import Image
from rapidfuzz import fuzz

from stet.normalize import compact, norm

TAIL_MIN = 85.0
HASH_MAX_DIST = 8


def tail(s: str) -> str:
    n = norm(s)
    k = max(60, int(len(n) * 0.35))
    return n[-k:]


@functools.lru_cache(maxsize=None)
def ahash(path: str) -> int | None:
    try:
        im = Image.open(path).convert("L").resize((16, 16))
    except Exception:
        return None
    px = list(im.getdata())
    avg = sum(px) / len(px)
    return sum(1 << i for i, p in enumerate(px) if p > avg)


def figures_match(a: dict, b: dict, web: Path) -> bool | None:
    fa = a["images"] + [f for o in a["options"] for f in o["images"]]
    fb = b["images"] + [f for o in b["options"] for f in o["images"]]
    if not fa and not fb:
        return None
    if bool(fa) != bool(fb) or len(fa) != len(fb):
        return False
    for x, y in zip(fa, fb):
        hx, hy = ahash(str(web / x)), ahash(str(web / y))
        if hx is None or hy is None or bin(hx ^ hy).count("1") > HASH_MAX_DIST:
            return False
    return True


def variables(s: str) -> list[str]:
    """Single-letter symbols in the question-specific part (syllogism terms, puzzle names, codes)."""
    return [t for t in re.findall(r"\b[a-z]\b", tail(s)) if t not in ("a", "i")]


def refine(pairs: list[dict], by_id: dict[str, dict], web: Path) -> None:
    for p in pairs:
        if p["type"] not in ("exact", "paraphrase"):
            continue
        a, b = by_id[p["a"]], by_id[p["b"]]
        t = fuzz.ratio(tail(a["text"]), tail(b["text"]))
        fig = figures_match(a, b, web)
        va, vb = variables(a["text"]), variables(b["text"])
        if va and vb and va != vb:
            p["type"], p["method"] = "different", "auto-refined"
            p["reason"] = "Same pattern of question, but with different terms/letters"
        elif t < TAIL_MIN:
            p["type"], p["method"] = "different", "auto-refined"
            p["reason"] = f"Shared instruction wording, but the question-specific part differs (tail similarity {t:.0f})"
        elif fig is False:
            p["type"], p["method"] = "different", "auto-refined"
            p["reason"] = "Same wording, but the figures differ"
        p["scores"]["tail"] = round(t, 1)


def same_answer(a_text: str, b_text: str) -> bool:
    x, y = compact(a_text or ""), compact(b_text or "")
    if not x or not y:
        return False
    return fuzz.ratio(x, y) >= 85 or (min(len(x), len(y)) >= 4 and fuzz.partial_ratio(x, y) >= 95)


def option_sets_match(a: dict, b: dict) -> bool:
    from stet.repeats import option_similarity

    return option_similarity([o["text"] for o in a["options"]], [o["text"] for o in b["options"]]) >= 80
