"""Low-level PDF reading: spans with geometry, font and colour, grouped into visual rows."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

DEVANAGARI_FONT_HINTS = ("nirmala", "devanagari", "mangal", "kokila", "aparajita", "utsaah", "kohinoor", "noto sans dev", "notosansdev")


@dataclass
class Span:
    page: int  # 1-based
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    font: str
    color: int

    @property
    def yc(self) -> float:
        return (self.y0 + self.y1) / 2

    @property
    def is_deva_font(self) -> bool:
        f = self.font.lower()
        return any(h in f for h in DEVANAGARI_FONT_HINTS)

    @property
    def rgb(self) -> tuple[int, int, int]:
        return (self.color >> 16) & 255, (self.color >> 8) & 255, self.color & 255


@dataclass
class Row:
    page: int
    spans: list[Span] = field(default_factory=list)

    @property
    def y(self) -> float:
        return min(s.y0 for s in self.spans)

    @property
    def text(self) -> str:
        return join_spans(self.spans)

    def deva_ratio(self) -> float:
        total = sum(len(s.text.strip()) for s in self.spans) or 1
        return sum(len(s.text.strip()) for s in self.spans if s.is_deva_font or has_devanagari(s.text)) / total


@dataclass
class PageImage:
    page: int
    xref: int
    width: int
    height: int
    rect: tuple[float, float, float, float]


def has_devanagari(s: str) -> bool:
    return any("ऀ" <= ch <= "ॿ" for ch in s)


def join_spans(spans: list[Span]) -> str:
    out = ""
    prev: Span | None = None
    for s in spans:
        t = s.text
        if prev is not None and out and not out.endswith(" ") and not t.startswith(" "):
            # insert a space only when there is a visible horizontal gap
            if s.x0 - prev.x1 > 1.5:
                out += " "
        out += t
        prev = s
    return out


def file_md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_spans(doc: pymupdf.Document) -> dict[int, list[Span]]:
    pages: dict[int, list[Span]] = {}
    for pno, page in enumerate(doc, start=1):
        spans: list[Span] = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for sp in line["spans"]:
                    if not sp["text"].strip():
                        continue
                    x0, y0, x1, y1 = sp["bbox"]
                    spans.append(Span(pno, x0, y0, x1, y1, sp["text"], sp["font"], sp["color"]))
        pages[pno] = spans
    return pages


def read_images(doc: pymupdf.Document) -> list[PageImage]:
    out = []
    for pno, page in enumerate(doc, start=1):
        for img in page.get_images(full=True):
            xref, w, h = img[0], img[2], img[3]
            try:
                rects = page.get_image_rects(xref)
            except Exception:  # pragma: no cover - defensive
                rects = []
            for r in rects:
                out.append(PageImage(pno, xref, w, h, (r.x0, r.y0, r.x1, r.y1)))
    return out


def group_rows(spans: list[Span], tol: float = 3.0) -> list[Row]:
    """Cluster spans of a single page into visual rows by vertical centre, then sort each row by x."""
    rows: list[Row] = []
    for s in sorted(spans, key=lambda s: (s.yc, s.x0)):
        if rows and abs(rows[-1].spans[-1].yc - s.yc) <= tol and s.page == rows[-1].page:
            rows[-1].spans.append(s)
        else:
            rows.append(Row(s.page, [s]))
    for r in rows:
        r.spans.sort(key=lambda s: s.x0)
    return rows
