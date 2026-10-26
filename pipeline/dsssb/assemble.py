"""Stage 2: turn extraction records into papers and questions with stable ids."""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

import pymupdf
from PIL import Image

from . import papers as registry
from .extract import CACHE

LETTERS = "ABCD"
EXAM_PATTERN_SECTIONS = {
    "General Awareness": 20,
    "General Intelligence & Reasoning": 20,
    "Arithmetical & Numerical Ability": 20,
    "Hindi Language": 20,
    "English Language": 20,
}


def make_paper(entry: dict, rec: dict) -> dict:
    reg = registry.lookup(rec["file"]["md5"])
    meta = rec.get("meta", {})
    if reg is None:
        # an unknown paper still gets processed; everything about it is marked unverified
        return {
            "id": f"unknown-{rec['file']['md5'][:8]}",
            "label": rec["file"]["name"],
            "labelHi": rec["file"]["name"],
            "shortLabel": rec["file"]["md5"][:6],
            "year": None,
            "postCode": None,
            "department": None,
            "dateStatus": "not-available",
            "shiftStatus": "not-available",
            "answerKey": {"label": "Key marked in the source PDF", "official": False, "detail": "This file is not in the paper registry; its metadata is unverified.", "evidence": []},
            "metaChecks": [],
            "metaConflicts": ["file is not in the paper registry (pipeline/dsssb/papers.py)"],
            "pdf": _pdf(rec),
            "printed": meta,
        }
    checks = registry.check(reg, meta, rec["file"]["name"])
    p = {k: v for k, v in reg.items() if not k.startswith("expect")}
    p["metaChecks"] = checks
    p["metaConflicts"] = [f"{c['field']}: {c['detail']}" for c in checks if c["result"] == "fail"]
    p["printed"] = {k: v for k, v in meta.items() if k != "sectionCounts"}
    p["pdf"] = _pdf(rec)
    p["sourceFormat"] = rec.get("format")
    return p


def _pdf(rec: dict) -> dict:
    name = rec["file"]["name"]
    return {"name": name, "md5": rec["file"]["md5"], "pages": rec["file"].get("pages"), "url": f"dsssb/pdfs/{name}"}


def make_questions(rec: dict, paper: dict) -> list[dict]:
    out = []
    qnos = [q["qno"] for q in rec["questions"]]
    for q in rec["questions"]:
        section, part = registry.canonical_section(q["section"])
        qid = f"{paper['id']}-q{q['qno']:03d}"
        opts = []
        for i, o in enumerate(q["options"]):
            opts.append(
                {
                    "label": LETTERS[i],
                    "text": o.get("text") or "",
                    "textHi": o.get("textHi") or None,
                    "images": [f["file"] for f in o.get("images", [])],
                    "imagesHi": [f["file"] for f in o.get("imagesHi", [])],
                    "textOrigin": o.get("textOrigin", "pdf-text-layer"),
                }
            )
        hi_only = q["primaryLang"] == "hi"
        text_hi = q.get("textHi")
        if hi_only:
            text_hi = q["text"]  # Hindi-language section: the question exists only in Hindi
            for o in opts:
                o["textHi"] = o["text"]
        out.append(
            {
                "id": qid,
                "paperId": paper["id"],
                "qno": q["qno"],
                "sectionQno": q.get("sectionQno"),
                "sourceQid": q.get("sourceQid"),
                "section": section,
                "sectionRaw": q["section"],
                "part": part,
                "lang": q["primaryLang"],
                "text": q["text"],
                "textHi": text_hi or None,
                "passage": q.get("passage"),
                "passageHi": q.get("passageHi"),
                "passageImages": [f["file"] for f in q.get("passageImages", [])],
                "options": opts,
                "images": [f["file"] for f in q.get("images", [])],
                "imagesHi": [f["file"] for f in q.get("imagesHi", [])],
                "figureText": q.get("figureText"),
                "textOrigin": q.get("textOrigin", "pdf-text-layer"),
                "source": {
                    "pdf": paper["pdf"]["name"],
                    "pdfUrl": paper["pdf"]["url"],
                    "page": q["page"],
                    "pageEnd": q["pageEnd"],
                    "pageEn": q.get("pageEn"),
                    "pageHi": q.get("pageHi"),
                    "regions": q.get("regions"),
                },
                "keyRaw": q["answerIndices"],
                "dropped": q.get("dropped", False),
                "officialNote": q.get("officialNote"),
                "extractionIssues": list(q["issues"]),
                "hindiFixes": q.get("hindiFixes", []),
                "ocr": _ocr_summary(q),
            }
        )
    # numbering and pattern checks are added as issues so they surface in verification
    dup = [n for n, c in Counter(qnos).items() if c > 1]
    gaps = sorted(set(range(1, max(qnos) + 1)) - set(qnos)) if qnos else []
    paper["numbering"] = {"count": len(qnos), "duplicates": dup, "gaps": gaps}
    return out


def _ocr_summary(q: dict) -> dict | None:
    confs = [f["ocr"]["meanConf"] for f in q.get("images", []) if f.get("ocr") and f["ocr"].get("meanConf") is not None]
    confs += [f["ocr"]["meanConf"] for o in q["options"] for f in o.get("images", []) if f.get("ocr") and f["ocr"].get("meanConf") is not None]
    if not confs:
        return None
    return {"engine": "apple-vision-accurate", "minConf": round(min(confs), 2), "meanConf": round(sum(confs) / len(confs), 2)}


def needs_visual_review(q: dict) -> bool:
    """Questions whose text did not come straight from a clean text layer are checked against the page image."""
    if q["textOrigin"] != "pdf-text-layer" or any(o["textOrigin"] != "pdf-text-layer" for o in q["options"]):
        return True
    if q["images"]:
        return True
    if q["section"] == "Hindi Language":
        return True  # decoded / repaired Devanagari
    return False


def render_review_image(q: dict, src_dir: Path, out_dir: Path, langs: tuple[str, ...] = ("en",)) -> Path:
    """One image with the question exactly as printed (all pages it spans), for side-by-side review."""
    dest = out_dir / f"{q['id']}.png"
    if dest.exists():
        return dest
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(src_dir / q["source"]["pdf"])
    parts: list[Image.Image] = []
    for lang in langs:
        reg = (q["source"].get("regions") or {}).get(lang)
        if not reg:
            continue
        p0, y0, p1, y1 = reg
        for pno in range(p0, p1 + 1):
            page = doc[pno - 1]
            top = y0 - 4 if pno == p0 else 0
            bottom = y1 if pno == p1 else page.rect.height
            if bottom - top < 8:
                continue
            clip = pymupdf.Rect(0, max(0, top), page.rect.width, min(page.rect.height, bottom))
            pix = page.get_pixmap(clip=clip, dpi=120)
            parts.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    doc.close()
    if not parts:
        parts = [Image.new("RGB", (400, 40), "white")]
    w = max(p.width for p in parts)
    h = sum(p.height + 6 for p in parts)
    sheet = Image.new("RGB", (w, h), "white")
    y = 0
    for p in parts:
        sheet.paste(p, (0, y))
        y += p.height + 6
    sheet.save(dest, optimize=True)
    return dest


REVIEW_DIR = CACHE / "review"


def option_digits(s: str) -> list[str]:
    return re.findall(r"\d+(?:\.\d+)?", s or "")
