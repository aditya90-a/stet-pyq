from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

LABELS = "ABCD"

LIGATURES = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", " ": " "}


def clean_text(s: str) -> str:
    """Display-safe cleanup: ligatures, NBSP, repeated spaces. Keeps wording/punctuation intact."""
    for k, v in LIGATURES.items():
        s = s.replace(k, v)
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    return s.strip()


def join_lines(lines: list[str]) -> str:
    """Join wrapped PDF lines. Hyphen-split words are kept verbatim (we cannot know if the hyphen is real)."""
    return clean_text("\n".join(l.strip() for l in lines if l.strip()))


def unwrap(s: str) -> str:
    """Single-line version of a wrapped paragraph (used for prose; code keeps newlines)."""
    return re.sub(r"\s*\n\s*", " ", s).strip()


@dataclass
class RawOption:
    label: str
    text: str
    text_hi: str | None = None


@dataclass
class RawQuestion:
    qno: int
    source_qid: str | None = None
    section: str | None = None
    text: str = ""
    text_hi: str | None = None
    options: list[RawOption] = field(default_factory=list)
    answer_index: int | None = None  # 0-based index into options, from the key printed in the source
    answer_text_in_source: str | None = None
    page: int = 0
    page_end: int = 0
    y_start: float = 0.0
    y_end: float = 0.0
    figures: list[dict] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)
    hindi_fixes: list[str] = field(default_factory=list)


@dataclass
class ParsedPaper:
    fmt: str
    meta: dict
    questions: list[RawQuestion]
    warnings: list[str] = field(default_factory=list)
