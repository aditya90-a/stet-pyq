"""Stage 1: read every source file, parse the question papers, render source images and run OCR.

Results are cached per file hash (pipeline/cache/dsssb/) so a re-run only processes new or changed files.
The original PDFs are opened read-only and never modified.
"""
from __future__ import annotations

import hashlib
import json
import logging
import shutil
import subprocess
import traceback
from datetime import datetime, timezone
from pathlib import Path

import pymupdf
from PIL import Image

from stet.pdfutil import PageImage, file_md5

from . import VERSION
from .parsers import digialm, edcil
from .pdf import read_images, read_spans

log = logging.getLogger("dsssb.extract")

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "pipeline" / "cache" / "dsssb"
OCR_BIN = ROOT / "pipeline" / "cache" / "bin" / "vision_ocr"
OCR_SRC = Path(__file__).with_name("vision_ocr.swift")
FIG_DPI = 150


def discover(src: Path) -> list[Path]:
    return sorted(p for p in src.rglob("*") if p.is_file() and not p.name.startswith("."))


def detect_format(raw: str) -> str | None:
    head = raw[:30000]
    if "Question Number :" in head and "Question Id :" in head:
        return edcil.FMT
    if "Question ID :" in head and "Option 1 ID" in head:
        return digialm.FMT
    return None


# ---------------------------------------------------------------- OCR (Apple Vision, macOS)

def ocr_available() -> bool:
    if OCR_BIN.exists():
        return True
    if shutil.which("swiftc") is None:
        return False
    OCR_BIN.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["swiftc", "-O", str(OCR_SRC), "-o", str(OCR_BIN)], capture_output=True, text=True)
    if r.returncode != 0:
        log.warning("could not build the Vision OCR helper: %s", r.stderr[-500:])
    return OCR_BIN.exists()


def ocr_images(paths: list[Path]) -> dict[str, dict]:
    """OCR many images; results cached by image content hash."""
    cache_file = CACHE / "ocr.json"
    cache: dict = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    keyed = {str(p): hashlib.md5(p.read_bytes()).hexdigest() for p in paths}
    todo = [p for p in paths if keyed[str(p)] not in cache]
    if todo and ocr_available():
        for i in range(0, len(todo), 200):
            chunk = todo[i : i + 200]
            r = subprocess.run([str(OCR_BIN), *map(str, chunk)], capture_output=True, text=True)
            for line in r.stdout.splitlines():
                o = json.loads(line)
                cache[keyed[o["file"]]] = {"lines": o.get("lines", []), "error": o.get("error")}
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(cache))
    out = {}
    for p in paths:
        c = cache.get(keyed[str(p)])
        if c is None:
            out[str(p)] = {"text": None, "conf": None, "engine": None, "error": "OCR unavailable"}
            continue
        lines = c["lines"]
        out[str(p)] = {
            "text": "\n".join(l["text"] for l in lines),
            "conf": round(min((l["conf"] for l in lines), default=0.0), 2),
            "meanConf": round(sum(l["conf"] for l in lines) / len(lines), 2) if lines else None,
            "engine": "apple-vision-accurate",
            "error": c.get("error"),
        }
    return out


# ---------------------------------------------------------------- figures

def render_region(doc: pymupdf.Document, im: PageImage, dest: Path, dpi: int = FIG_DPI) -> None:
    if dest.exists():
        return
    page = doc[im.page - 1]
    r = pymupdf.Rect(*im.rect) + (-1, -1, 1, 1)
    pix = page.get_pixmap(clip=r & page.rect, dpi=dpi)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    # screenshots of typed text: a small palette keeps them sharp and light
    img.quantize(colors=48, method=Image.Quantize.MEDIANCUT).save(dest, optimize=True)


def _figures(doc, q: dict, md5: str, fig_dir: Path) -> None:
    """Replace PageImage objects with rendered figure records."""
    fig_dir.mkdir(parents=True, exist_ok=True)

    def rec(im: PageImage, tag: str) -> dict:
        name = f"{md5[:8]}-q{q['qno']:03d}-{tag}.png"
        render_region(doc, im, fig_dir / name)
        return {"file": f"dsssb/figures/{name}", "page": im.page, "rect": [round(v, 1) for v in im.rect]}

    q["images"] = [rec(im, f"q{i + 1}") for i, im in enumerate(q["images"])]
    q["imagesHi"] = [rec(im, f"qh{i + 1}") for i, im in enumerate(q.get("imagesHi", []))]
    q["passageImages"] = [rec(im, f"p{i + 1}") for i, im in enumerate(q.get("passageImages", []))]
    for n, o in enumerate(q["options"], start=1):
        o["images"] = [rec(im, f"o{n}{'' if i == 0 else i + 1}") for i, im in enumerate(o.get("images", []))]
        o["imagesHi"] = [rec(im, f"oh{n}{'' if i == 0 else i + 1}") for i, im in enumerate(o.get("imagesHi", []))]


def _apply_ocr(questions: list[dict], web: Path) -> None:
    """OCR every English-language source image.  For image-only questions the OCR text becomes the working
    text (marked as OCR) until the transcription review confirms or corrects it."""
    paths: list[Path] = []
    for q in questions:
        if q["primaryLang"] != "en":
            continue
        for f in q["images"]:
            paths.append(web / f["file"])
        for o in q["options"]:
            for f in o["images"]:
                paths.append(web / f["file"])
    res = ocr_images(paths)
    for q in questions:
        q["textOrigin"] = "pdf-text-layer"
        if q["primaryLang"] != "en":
            if q["images"] and not q["text"].strip():
                q["textOrigin"] = "image-only"
            continue
        for f in q["images"]:
            f["ocr"] = res.get(str(web / f["file"]))
        for o in q["options"]:
            for f in o["images"]:
                f["ocr"] = res.get(str(web / f["file"]))
        q_ocr = "\n".join((f.get("ocr") or {}).get("text") or "" for f in q["images"]).strip()
        if not q["text"].strip() and q["images"]:
            q["text"] = q_ocr
            q["textOrigin"] = "ocr" if q_ocr else "image-only"
        elif q["images"]:
            q["figureText"] = q_ocr or None
        for o in q["options"]:
            if not o["text"].strip() and o["images"]:
                o["text"] = "\n".join((f.get("ocr") or {}).get("text") or "" for f in o["images"]).strip()
                o["textOrigin"] = "ocr" if o["text"] else "image-only"
                if q["textOrigin"] == "pdf-text-layer":
                    q["textOrigin"] = "mixed-ocr"


# ---------------------------------------------------------------- main entry

def extract_pdf(path: Path, web: Path, force: bool = False) -> dict:
    md5 = file_md5(path)
    cache_file = CACHE / f"{md5}.json"
    if cache_file.exists() and not force:
        rec = json.loads(cache_file.read_text())
        if rec.get("version") == VERSION:
            rec["fromCache"] = True
            return rec
    rec: dict = {
        "version": VERSION,
        "file": {"name": path.name, "md5": md5, "sizeBytes": path.stat().st_size},
        "status": "error",
        "errors": [],
        "warnings": [],
        "questions": [],
        "extractedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    try:
        doc = pymupdf.open(path)
    except Exception as e:
        rec["errors"].append(f"cannot open PDF: {e}")
        return rec
    try:
        rec["file"]["pages"] = doc.page_count
        raw = "\n".join(p.get_text() for p in doc)
        rec["textChars"] = len(raw)
        rec["emptyTextPages"] = [i + 1 for i, p in enumerate(doc) if len(p.get_text().strip()) < 20]
        if len(raw.strip()) < 200:
            rec |= _scanned(doc, path, md5)
            return rec
        fmt = detect_format(raw)
        rec["format"] = fmt
        pages = read_spans(doc)
        images = read_images(doc)
        if fmt == edcil.FMT:
            meta, qs, warns = edcil.parse(pages, images, raw)
        elif fmt == digialm.FMT:
            meta, qs, warns = digialm.parse(pages, images, raw)
        else:
            rec["errors"].append("unrecognised layout - no parser matched")
            rec["status"] = "unsupported_layout"
            return rec
        for q in qs:
            _figures(doc, q, md5, web / "dsssb" / "figures")
        _apply_ocr(qs, web)
        rec["meta"] = meta
        rec["warnings"] += warns
        rec["questions"] = qs
        q_pages = {p for q in qs for p in range(q["page"], q["pageEnd"] + 1)}
        rec["pagesWithoutQuestions"] = [p for p in range(1, doc.page_count + 1) if p not in q_pages]
        rec["status"] = "ok" if qs else "no_questions"
    except Exception as e:  # keep going with the other files
        rec["errors"].append(f"{type(e).__name__}: {e}")
        rec["traceback"] = traceback.format_exc()
        log.exception("failed on %s", path)
    finally:
        doc.close()
    if rec["status"] in ("ok", "ocr"):
        CACHE.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(rec, ensure_ascii=False))
    return rec


def _scanned(doc: pymupdf.Document, path: Path, md5: str) -> dict:
    """A scanned document (no text layer): render each page and OCR it."""
    out_dir = CACHE / "scans"
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, page in enumerate(doc, start=1):
        dest = out_dir / f"{md5[:8]}-p{i}.png"
        if not dest.exists():
            page.get_pixmap(dpi=200).save(dest)
        paths.append(dest)
    res = ocr_images(paths)
    pages = [{"page": i + 1, **res[str(p)]} for i, p in enumerate(paths)]
    ok = all(p["text"] for p in pages)
    return {
        "format": "scanned-document",
        "status": "ocr" if ok else "needs_ocr",
        "ocrPages": pages,
        "errors": [] if ok else ["no text layer and OCR is not available on this machine"],
    }
