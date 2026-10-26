"""Text normalisation used for duplicate detection and search.  Original text is never modified;
normalised forms are stored in separate fields."""
from __future__ import annotations

import re
import unicodedata

_QUOTES = {"‘": "'", "’": "'", "‛": "'", "“": '"', "”": '"', "`": "'", "´": "'", "–": "-", "—": "-", "−": "-", "…": "...", "×": "x"}
_STOP = set(
    "a an the of to in on for is are was were be by with and or as at from that this which what who whom whose when where why how "
    "following among given its it their there these those does do did can could should would will shall may might into than then "
    "used use called known type types term one ___ _____".split()
)
# Hindi search folding: nukta forms, candrabindu/anusvara, zero-width joiners
_HI_FOLD = {
    "़": "",  # nukta
    "ँ": "ं",  # candrabindu -> anusvara
    "‌": "",
    "‍": "",
    "।": " ",  # danda
    "॥": " ",
}


def fold(s: str) -> str:
    """Lowercase + unify punctuation/quotes + strip accents/nukta; keeps word characters of any script."""
    s = unicodedata.normalize("NFKC", s or "")
    for k, v in _QUOTES.items():
        s = s.replace(k, v)
    for k, v in _HI_FOLD.items():
        s = s.replace(k, v)
    return s.lower()


def norm(s: str) -> str:
    """Canonical comparison form: folded, punctuation removed (except symbols that carry meaning in CS
    questions such as ' + * / < > = ^ ~ & |), whitespace collapsed."""
    raw = s or ""
    s = fold(s)
    s = re.sub(r"_{2,}|\.{3,}|…+", " _ ", s)
    s = re.sub(r"[^\w\s'+*/<>=^~&|%#!-]", " ", s)
    s = re.sub(r"(?<=\w)-(?=\w)", "", s)  # full-adder == full adder == fulladder
    s = re.sub(r"\s+", " ", s).strip()
    if not s and raw.strip():
        # symbol-only strings such as "{ }" or "< >" keep their symbols so they stay distinguishable
        s = re.sub(r"\s+", "", fold(raw))
    return s


def compact(s: str) -> str:
    """Spacing-insensitive form for search ("full -adder" == "full adder" == "fulladder")."""
    return re.sub(r"[\s'\"_.,;:?()\[\]{}-]+", "", fold(s))


def tokens(s: str) -> list[str]:
    return [t for t in norm(s).split() if t not in _STOP and len(t) > 1 or t.isdigit()]


def option_key(options: list[str]) -> str:
    return "|".join(sorted(norm(o) for o in options))
