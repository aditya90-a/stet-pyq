"""Stage 1: discover PDFs, detect their layout, extract questions.  Results are cached per file hash
so an interrupted or repeated run only re-processes new or changed PDFs."""
from __future__ import annotations

import json
import logging
import re
import traceback
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

from . import PIPELINE_VERSION, hindi
from .parsers import bseb_qp, digialm_response, sify_response
from .parsers.common import ParsedPaper, RawQuestion, clean_text
from .pdfutil import PageImage, file_md5, read_images, read_spans

log = logging.getLogger("stet.extract")

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def discover(src: Path) -> list[Path]:
    return sorted(p for p in src.rglob("*") if p.is_file() and not p.name.startswith("."))


def detect_format(raw_text: str) -> str | None:
    head = raw_text[:20000]
    for mod in (bseb_qp, sify_response, digialm_response):
        if mod.detect(head):
            return mod.FMT
    return None


def extract_pdf(path: Path, cache_dir: Path, figures_dir: Path, force: bool = False) -> dict:
    md5 = file_md5(path)
    cache_file = cache_dir / f"{md5}.json"
    if cache_file.exists() and not force:
        cached = json.loads(cache_file.read_text())
        if cached.get("pipelineVersion") == PIPELINE_VERSION:
            cached["fromCache"] = True
            cached["file"]["path"] = str(path)
            return cached

    rec: dict = {
        "pipelineVersion": PIPELINE_VERSION,
        "file": {"name": path.name, "path": str(path), "md5": md5, "sizeBytes": path.stat().st_size},
        "status": "error",
        "errors": [],
        "warnings": [],
        "questions": [],
        "extractedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    try:
        doc = pymupdf.open(path)
    except Exception as e:  # corrupted / not a PDF
        rec["errors"].append(f"cannot open PDF: {e}")
        return rec
    try:
        rec["file"]["pages"] = doc.page_count
        if doc.is_encrypted:
            rec["errors"].append("PDF is encrypted")
            return rec
        pages = read_spans(doc)
        raw_text = "\n".join(p.get_text() for p in doc)
        empty_pages = [i for i, sp in pages.items() if not sp]
        rec["emptyTextPages"] = empty_pages
        rec["textChars"] = len(raw_text)
        if len(raw_text.strip()) < 200:
            rec["errors"].append("no extractable text layer (scanned PDF?) - OCR required; tesseract is not installed")
            rec["status"] = "needs_ocr"
            return rec
        fmt = detect_format(raw_text)
        rec["format"] = fmt
        width = doc[0].rect.width
        images = read_images(doc)
        if fmt == bseb_qp.FMT:
            parsed = bseb_qp.parse(pages, width)
        elif fmt == sify_response.FMT:
            parsed = sify_response.parse(pages, width, raw_text)
        elif fmt == digialm_response.FMT:
            parsed = digialm_response.parse(pages, width, raw_text, images)
        else:
            rec["errors"].append("unrecognised layout - no parser matched")
            rec["status"] = "unsupported_layout"
            return rec
        if fmt != digialm_response.FMT:
            _attach_generic_figures(parsed.questions, images, doc)
        _repair_hindi(parsed)
        _render_figures(doc, parsed.questions, figures_dir, md5)
        rec["meta"] = parsed.meta
        rec["warnings"] += parsed.warnings
        rec["questions"] = [_q_to_dict(q) for q in parsed.questions]
        rec["status"] = "ok" if parsed.questions else "no_questions"
        if not parsed.questions:
            rec["errors"].append("layout recognised but no questions parsed")
        # pages that are only adverts / covers are listed so coverage can be audited
        q_pages = set()
        for q in parsed.questions:
            q_pages.update(range(q.page, q.page_end + 1))
        rec["pagesWithoutQuestions"] = [p for p in range(1, doc.page_count + 1) if p not in q_pages]
    except Exception as e:
        rec["errors"].append(f"{type(e).__name__}: {e}")
        rec["traceback"] = traceback.format_exc()
        log.exception("failed on %s", path)
    finally:
        doc.close()
    cache_dir.mkdir(parents=True, exist_ok=True)
    if rec["status"] == "ok":
        cache_file.write_text(json.dumps(rec, ensure_ascii=False))
    return rec


def _q_to_dict(q: RawQuestion) -> dict:
    d = asdict(q)
    d["options"] = [asdict(o) for o in q.options]
    return d


def _repair_hindi(parsed: ParsedPaper) -> None:
    texts = [q.text_hi or "" for q in parsed.questions] + [o.text_hi or "" for q in parsed.questions for o in q.options]
    joined = "\n".join(texts)
    if not joined.strip():
        return
    # a paper is "visual order" when words frequently begin with the i-matra (impossible in logical order)
    visual = len(re.findall(r"(?:^|\s)ि", joined)) >= 10
    parsed.meta["hindiVisualOrderRepaired"] = visual
    for q in parsed.questions:
        if q.text_hi:
            q.text_hi, fx = hindi.repair(q.text_hi, visual)
            q.hindi_fixes += fx
        for o in q.options:
            if o.text_hi:
                o.text_hi, fx = hindi.repair(o.text_hi, visual)
                q.hindi_fixes += fx
        q.hindi_fixes = sorted(set(q.hindi_fixes))


def _attach_generic_figures(questions: list[RawQuestion], images: list[PageImage], doc) -> None:
    from collections import Counter

    xref_count = Counter(i.xref for i in images)
    for img in images:
        x0, y0, x1, y1 = img.rect
        if xref_count[img.xref] > 3 or (x1 - x0) < 40 or (y1 - y0) < 25:
            continue  # repeated decoration or tiny icon (e.g. radio buttons)
        if img.page == 1 and y0 < 120:
            continue  # board logo in header
        for q in questions:
            starts_before = (q.page, q.y_start - 5) <= (img.page, y0)
            ends_after = (img.page, y1) <= (q.page_end, q.y_end + 60) or img.page < q.page_end
            if starts_before and ends_after:
                q.figures.append({"page": img.page, "rect": [round(v, 1) for v in img.rect], "xref": img.xref})
                break
        else:
            # image after the last row of a question on the page: attach to the closest preceding question
            prev = [q for q in questions if (q.page, q.y_start) <= (img.page, y0)]
            if prev:
                prev[-1].figures.append({"page": img.page, "rect": [round(v, 1) for v in img.rect], "xref": img.xref, "attachment": "nearest-preceding"})


def _render_figures(doc, questions: list[RawQuestion], figures_dir: Path, md5: str) -> None:
    figures_dir.mkdir(parents=True, exist_ok=True)
    for q in questions:
        for i, f in enumerate(q.figures):
            page = doc[f["page"] - 1]
            name = f"{md5[:8]}-q{q.qno:03d}-{i + 1}.png"
            pix = page.get_pixmap(clip=pymupdf.Rect(*f["rect"]), dpi=144)
            pix.save(figures_dir / name)
            f["file"] = name
