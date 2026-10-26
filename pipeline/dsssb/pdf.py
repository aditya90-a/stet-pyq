"""PDF reading for the DSSSB parsers: spans with font size and baseline, and every placed image."""
from __future__ import annotations

from dataclasses import dataclass

import pymupdf

from stet.pdfutil import PageImage, Span


@dataclass
class SSpan(Span):
    size: float = 0.0
    base: float = 0.0  # baseline y

    # glyph boxes from fonts such as Cambria Math are far taller than the printed text, so vertical
    # position is taken from the baseline and size instead of the bounding box
    @property
    def top(self) -> float:
        return self.base - 0.8 * self.size if self.size else self.y0

    @property
    def bottom(self) -> float:
        return self.base + 0.25 * self.size if self.size else self.y1


def row_top(spans) -> float:
    return min(getattr(s, "top", s.y0) for s in spans)


def row_bottom(spans) -> float:
    return max(getattr(s, "bottom", s.y1) for s in spans)


def read_spans(doc: pymupdf.Document) -> dict[int, list[SSpan]]:
    pages: dict[int, list[SSpan]] = {}
    for pno, page in enumerate(doc, start=1):
        out: list[SSpan] = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for sp in line["spans"]:
                    if not sp["text"].strip():
                        continue
                    x0, y0, x1, y1 = sp["bbox"]
                    out.append(SSpan(pno, x0, y0, x1, y1, sp["text"], sp["font"], sp["color"], sp["size"], sp["origin"][1]))
        pages[pno] = out
    return pages


def read_images(doc: pymupdf.Document) -> list[PageImage]:
    """Every image placement, including ones inside form XObjects (which get_image_rects misses)."""
    out: list[PageImage] = []
    for pno, page in enumerate(doc, start=1):
        for b in page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_IMAGES)["blocks"]:
            if b.get("type") == 1:
                x0, y0, x1, y1 = b["bbox"]
                if x1 - x0 < 1 or y1 - y0 < 1:
                    continue
                out.append(PageImage(pno, b.get("xref", 0) or 0, b["width"], b["height"], (x0, y0, x1, y1)))
    return out
