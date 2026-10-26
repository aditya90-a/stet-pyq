"""Prepare the AI review inputs: unique questions (exact duplicates collapsed) in batches, plus a source
image for every question whose text needs checking against the printed page.

    PYTHONPATH=pipeline .venv/bin/python -m dsssb.prep --src /path/to/pdfs
"""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from stet.repeats import build_groups, find_pairs

from .assemble import REVIEW_DIR, make_paper, make_questions, needs_visual_review, render_review_image
from .extract import discover, extract_pdf
from .repeats import refine

ROOT = Path(__file__).resolve().parents[2]
ANNOT = ROOT / "pipeline" / "dsssb" / "annotations"
LETTERS = "ABCD"


def load_all(src: Path, web: Path, force: bool = False):
    manifest, records = [], []
    for f in discover(src):
        entry = {"name": f.name, "relativePath": str(f.relative_to(src)), "sizeBytes": f.stat().st_size, "type": f.suffix.lower().lstrip(".")}
        if f.suffix.lower() != ".pdf":
            entry["status"] = "skipped"
            entry["note"] = "not a PDF"
            manifest.append(entry)
            continue
        rec = extract_pdf(f, web, force=force)
        entry |= {
            "md5": rec["file"]["md5"],
            "pages": rec["file"].get("pages"),
            "status": rec["status"],
            "format": rec.get("format"),
            "questionsExtracted": len(rec["questions"]),
            "errors": rec["errors"],
            "warnings": rec.get("warnings", []),
            "emptyTextPages": rec.get("emptyTextPages", []),
            "pagesWithoutQuestions": rec.get("pagesWithoutQuestions", []),
        }
        manifest.append(entry)
        records.append((entry, rec))
    seen: dict[str, str] = {}
    for e in manifest:
        if e.get("md5"):
            if e["md5"] in seen:
                e["duplicateOf"], e["status"] = seen[e["md5"]], "duplicate-file"
            else:
                seen[e["md5"]] = e["name"]
    papers: dict[str, dict] = {}
    questions: list[dict] = []
    for entry, rec in records:
        if rec["status"] != "ok" or entry.get("duplicateOf"):
            continue
        p = make_paper(entry, rec)
        papers[p["id"]] = p
        qs = make_questions(rec, p)
        p["questionCount"] = len(qs)
        questions += qs
        entry["paperId"] = p["id"]
    return manifest, records, papers, questions


def repeat_input(q: dict) -> dict:
    """Shape expected by stet.repeats: English (or Hindi-only) text, option texts and the keyed index."""
    return {"id": q["id"], "text": q["text"], "options": [{"text": o["text"]} for o in q["options"]], "answerIndex": q["keyRaw"][0] if len(q["keyRaw"]) == 1 else None}


def exact_groups(questions: list[dict], web: Path = ROOT / "public") -> tuple[list[dict], dict[str, list[str]]]:
    pairs = find_pairs([repeat_input(q) for q in questions])
    refine(pairs, {q["id"]: q for q in questions}, web)
    groups = build_groups(pairs, {"exact"})
    return pairs, groups


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", required=True)
    ap.add_argument("--web", default=str(ROOT / "public"))
    ap.add_argument("--batch", type=int, default=50)
    ap.add_argument("--visual-batch", type=int, default=25)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    src, web = Path(a.src), Path(a.web)
    _, _, papers, questions = load_all(src, web, a.force)
    pairs, groups = exact_groups(questions)
    member_of = {m: rep for rep, ms in groups.items() for m in ms}
    by_id = {q["id"]: q for q in questions}
    visual, text = [], []
    for q in questions:
        if member_of.get(q["id"], q["id"]) != q["id"]:
            continue  # annotated through its group representative
        copies = groups.get(q["id"], [q["id"]])
        vis = any(needs_visual_review(by_id[c]) for c in copies)
        item = {
            "id": q["id"],
            "copies": copies,
            "paper": papers[q["paperId"]]["label"],
            "section": q["section"],
            "language": q["lang"],
            "passage": q["passage"],
            "text": q["text"],
            "options": [f"{o['label']}) {o['text']}" for o in q["options"]],
            "sourceKey": "".join(LETTERS[i] for i in q["keyRaw"]) or None,
            "officialNote": q["officialNote"],
            "textOrigin": q["textOrigin"],
        }
        keys = {tuple(by_id[c]["keyRaw"]) for c in copies}
        if len(keys) > 1:
            item["keysAcrossCopies"] = {c: "".join(LETTERS[i] for i in by_id[c]["keyRaw"]) for c in copies}
        if vis:
            langs = ("en", "hi") if q["lang"] == "hi" and q["source"]["regions"].get("hi") else ("en",)
            img = render_review_image(q, src, REVIEW_DIR, langs)
            item["reviewImage"] = str(img.relative_to(ROOT))
            visual.append(item)
        else:
            text.append(item)
    inp = ANNOT / "input"
    inp.mkdir(parents=True, exist_ok=True)
    for old in inp.glob("*.json"):
        old.unlink()
    n = 0
    for chunk_size, items, kind in ((a.visual_batch, visual, "visual"), (a.batch, text, "text")):
        for i in range(0, len(items), chunk_size):
            n += 1
            (inp / f"{kind}_{n:02d}.json").write_text(json.dumps(items[i : i + chunk_size], ensure_ascii=False, indent=1))
    review = [p for p in pairs if p["type"] == "review"]
    for i in range(0, len(review), 120):
        rows = [
            {"a": p["a"], "b": p["b"], "scores": p["scores"], "reason": p["reason"],
             "qa": {"text": by_id[p["a"]]["text"], "options": [o["text"] for o in by_id[p["a"]]["options"]], "key": "".join(LETTERS[j] for j in by_id[p["a"]]["keyRaw"])},
             "qb": {"text": by_id[p["b"]]["text"], "options": [o["text"] for o in by_id[p["b"]]["options"]], "key": "".join(LETTERS[j] for j in by_id[p["b"]]["keyRaw"])}}
            for p in review[i : i + 120]
        ]
        (inp / f"pairs_{i // 120 + 1:02d}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    print(json.dumps({"questions": len(questions), "unique": len(visual) + len(text), "visual": len(visual), "text": len(text),
                      "exactGroups": len(groups), "pairs": {t: sum(p["type"] == t for p in pairs) for t in ("exact", "paraphrase", "review")}, "batches": n}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
