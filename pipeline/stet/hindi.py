"""Repair of Devanagari text extracted from PDFs.

Some source PDFs (2024 shift 2/3) embed Hindi with a font that stores glyphs in *visual* order:
the short-i matra (ि) is stored before its consonant cluster, and the reph (र्) after the syllable
it sits on.  Others (2024 shift 1) duplicate the aa-matra (ा).  These repairs restore logical
Unicode order so that the text displays and searches correctly.  They are heuristics: every
repaired string is flagged so it can be reviewed against the PDF.
"""
from __future__ import annotations

import re
import unicodedata

CONS = "क-हक़-य़ॸ-ॿ"  # consonants incl. nukta forms
NUKTA = "़"
HALANT = "्"
I_MATRA = "ि"
MATRAS = "ा-ौॢॣ"  # dependent vowel signs (excl. halant)
MODS = "ऀ-ः"  # candrabindu, anusvara, visarga

_cluster = rf"[{CONS}]{NUKTA}?(?:{HALANT}[{CONS}]{NUKTA}?)*"
_I_VISUAL = re.compile(rf"{I_MATRA}({_cluster})")
# in visual-order text every reph (र्) is stored after the syllable it belongs to
_REPH_VISUAL = re.compile(rf"({_cluster}[{MATRAS}]*[{MODS}]*)र{HALANT}")
_DUP_MATRA = re.compile(rf"([{MATRAS}])\1+")
_VISUAL_HINT = re.compile(rf"(^|[\s(\"'‘“-]){I_MATRA}")


def looks_visual_order(s: str) -> bool:
    """A word that *starts* with the i-matra can only come from visual-order extraction."""
    return bool(_VISUAL_HINT.search(s))


def repair_visual_order(s: str) -> str:
    s = _I_VISUAL.sub(lambda m: m.group(1) + I_MATRA, s)
    s = _REPH_VISUAL.sub(lambda m: "र" + HALANT + m.group(1), s)
    return s


def repair(s: str, visual_order: bool | None = None) -> tuple[str, list[str]]:
    """Return (repaired_text, list_of_fixes_applied)."""
    fixes: list[str] = []
    if not s:
        return s, fixes
    out = unicodedata.normalize("NFC", s)
    # a dependent vowel sign repeated back-to-back is never valid Hindi (font artefact: क्याा, फ्लॉॉप)
    collapsed = _DUP_MATRA.sub(r"\1", out)
    if collapsed != out:
        out = collapsed
        fixes.append("collapsed-duplicate-matra")
    if visual_order is None:
        visual_order = looks_visual_order(out)
    if visual_order:
        new = repair_visual_order(out)
        if new != out:
            fixes.append("visual-order-reordered")
        out = new
    out = re.sub(r"\s+([।?,])", r"\1", out)
    return out, fixes
