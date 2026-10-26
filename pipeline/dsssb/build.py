"""Build the DSSSB TGT Computer Science dataset for the web app.

    PYTHONPATH=pipeline .venv/bin/python -m dsssb.build --src /Users/apple/Documents/TGT-DSSSB

Stages: extract (cached per PDF) -> assemble -> merge the AI review layer (transcription checks, topics,
answer checks, explanations, pair verdicts) -> repeat detection -> verification -> analysis -> outputs:
  public/dsssb/data/*.json   compact data for the app
  data/dsssb/*.json          full records
  reports/dsssb/*            verification and analysis reports (Markdown + CSV)
The source PDFs are only read.  With --copy-pdfs they are copied (not moved) to public/dsssb/pdfs/ for the
local PDF library; that folder is git-ignored.
"""
from __future__ import annotations

import argparse
import json
import logging
import shutil
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from rapidfuzz import fuzz

from stet.normalize import norm
from stet.repeats import build_groups, find_pairs

from . import VERSION, reports, verify
from .assemble import REVIEW_DIR
from .prep import exact_groups, load_all, repeat_input
from .repeats import option_sets_match, refine, same_answer
from .syllabus import exam_info, syllabus_record
from .taxonomy import TAXONOMY, validate_label

log = logging.getLogger("dsssb.build")
ROOT = Path(__file__).resolve().parents[2]
ANNOT = ROOT / "pipeline" / "dsssb" / "annotations"
NOTES = ROOT / "pipeline" / "dsssb" / "notes"
LETTERS = "ABCD"
UNCLASSIFIED = "Unclassified"
_ov = ANNOT / "overrides.json"
OVERRIDES = {k: v for k, v in json.loads(_ov.read_text()).items() if not k.startswith("_")} if _ov.exists() else {}


# ------------------------------------------------------------------ AI review layer

def load_annotations() -> tuple[dict, list[dict], list[str]]:
    ann: dict[str, dict] = {}
    adjud: list[dict] = []
    errors: list[str] = []
    d = ANNOT / "ai"
    for f in sorted(d.glob("*.json")) if d.exists() else []:
        try:
            rows = json.loads(f.read_text())
        except Exception as e:  # a broken file is reported, never silently used
            errors.append(f"{f.name}: {e}")
            continue
        if f.name.startswith("pairs_"):
            adjud += rows
        else:
            for a in rows:
                ann[a["id"]] = a | {"_file": f.name}
    return ann, adjud, errors


def _map_letter(src_q: dict, letter: str | None, dst_q: dict) -> int | None:
    """Translate an answer letter for src_q's option order into dst_q's option index."""
    if not letter or letter not in LETTERS:
        return None
    i = LETTERS.index(letter)
    if src_q is dst_q:
        return i
    t = norm(src_q["options"][i]["text"])
    scores = [fuzz.ratio(t, norm(o["text"])) for o in dst_q["options"]]
    best = max(range(len(scores)), key=lambda j: scores[j])
    return best if scores[best] >= 85 else None


def apply_transcriptions(questions: list[dict], ann: dict) -> None:
    for q in questions:
        a = ann.get(q["id"])
        img = REVIEW_DIR / f"{q['id']}.png"
        if img.exists():
            q["reviewImage"] = str(img.relative_to(ROOT))
        q["corrections"] = []
        q["verificationNotes"] = []
        t = (a or {}).get("transcription")
        if not t:
            continue
        q["transcription"] = {k: t.get(k) for k in ("verdict", "keyInImage", "printedErrors", "changes")}
        if t.get("verdict") == "unreadable":
            q["verificationNotes"].append("Reviewer could not read the page image.")
            continue
        reason = {
            "ocr": "OCR error corrected against the printed page",
            "mixed-ocr": "OCR error corrected against the printed page",
            "image-only": "transcribed from the printed page",
        }.get(q["textOrigin"], "extraction error corrected against the printed page")
        hi_only = q["lang"] == "hi"
        new_text = (t.get("text") or "").strip()
        if new_text:
            c = verify.correction("text", q["text"], new_text, q, reason)
            if c:
                q["corrections"].append(c)
            q["text"] = new_text
            if hi_only:
                q["textHi"] = new_text
        for o, new in zip(q["options"], t.get("options") or []):
            new = (new or "").strip()
            if not new and o["images"]:
                continue  # an option that is only a picture keeps its image
            c = verify.correction(f"option {o['label']}", o["text"], new, q, reason)
            if c:
                q["corrections"].append(c)
            o["text"] = new
            if hi_only:
                o["textHi"] = new
            if o["textOrigin"] != "pdf-text-layer":
                o["textOrigin"] = "ocr-reviewed"
        # formatting-only changes (spacing, line breaks) are not counted as corrections
        content = [c for c in q["corrections"] if c["kind"] == "content"]
        q["corrections"] = content
        if q["textOrigin"] in ("ocr", "mixed-ocr"):
            q["textOrigin"] = "ocr-corrected" if content else "ocr-confirmed"
        elif q["textOrigin"] == "image-only":
            q["textOrigin"] = "transcribed"
        if t.get("figureDescription"):
            q["figureDescription"] = t["figureDescription"]
        if t.get("printedErrors"):
            q["verificationNotes"].append("Printed in the source paper: " + t["printedErrors"])


def apply_annotations(questions: list[dict], ann: dict, exact: dict[str, list[str]]) -> None:
    by_id = {q["id"]: q for q in questions}
    group_of = {m: g for g, ms in exact.items() for m in ms}
    for q in questions:
        a, src = ann.get(q["id"]), q
        if a is None and q["id"] in group_of:
            for m in exact[group_of[q["id"]]]:
                if m in ann:
                    a, src = ann[m], by_id[m]
                    break
        default_subject = q["section"] if q["section"] in TAXONOMY else "Computer Science"
        if not a:
            q["classification"] = {"subject": default_subject, "topic": UNCLASSIFIED, "subtopic": UNCLASSIFIED, "method": "none"}
            q["concept"] = None
            q["difficulty"] = "not rated"
            q["explanation"] = None
            q["aiCheck"] = None
            continue
        subject = a.get("subject") or default_subject
        if q["part"] == "A":
            subject = q["section"]  # Section A questions always belong to their printed section
        topic, subtopic = a.get("topic"), a.get("subtopic")
        ok = validate_label(subject, topic, subtopic)
        q["classification"] = {
            "subject": subject,
            "topic": topic if ok else UNCLASSIFIED,
            "subtopic": subtopic if ok else UNCLASSIFIED,
            "method": "ai-assisted" if ok else "ai-label-outside-taxonomy",
        }
        if not ok:
            q["extractionIssues"].append(f"classification outside taxonomy: {subject} / {topic} / {subtopic}")
        if (o := OVERRIDES.get(q["id"])) and validate_label(subject, o["topic"], o["subtopic"]):
            q["classification"] |= {"topic": o["topic"], "subtopic": o["subtopic"], "method": "manual-override", "overrideReason": o["reason"]}
        q["concept"] = (a.get("concept") or "").strip() or None
        q["difficulty"] = a.get("difficulty") if a.get("difficulty") in ("easy", "medium", "hard") else "not rated"
        q["explanation"] = {"text": a.get("explanation") or "", "origin": "ai-generated", "annotatedFrom": src["id"]} if a.get("explanation") else None
        d = _map_letter(src, a.get("derivedAnswer"), q)
        q["aiCheck"] = {
            "derivedIndex": d,
            "derivedLabel": LETTERS[d] if d is not None else None,
            "confidence": a.get("derivedConfidence"),
            "assessment": a.get("keyAssessment"),
            "note": a.get("keyNote") or "",
            "reviewedAs": src["id"],
        }


# ------------------------------------------------------------------ repeats

def paper_order(p: dict) -> tuple:
    return (p.get("year") or 9999, p.get("date") or p.get("inferredDate") or "", p.get("set") or p.get("shift") or 9)


def apply_repeats(questions: list[dict], papers: dict[str, dict], adjud: list[dict], web: Path) -> dict:
    pairs = find_pairs([repeat_input(q) for q in questions])
    refine(pairs, {q["id"]: q for q in questions}, web)
    verdicts = {tuple(sorted((v["a"], v["b"]))): v for v in adjud if v.get("verdict") in ("paraphrase", "concept", "different")}
    for p in pairs:
        if p["type"] == "review" and (v := verdicts.get(tuple(sorted((p["a"], p["b"]))))):
            p["type"], p["method"], p["reason"] = v["verdict"], "ai-adjudicated", v.get("reason") or p["reason"]
    by_id = {q["id"]: q for q in questions}
    exact = build_groups(pairs, {"exact"})
    repeat = build_groups(pairs, {"exact", "paraphrase"})
    concept_pairs = [p for p in pairs if p["type"] in ("exact", "paraphrase", "concept")]
    by_concept = defaultdict(list)
    for q in questions:
        if q.get("concept"):
            by_concept[(q["classification"]["subject"], q["concept"].lower())].append(q["id"])
    for ids in by_concept.values():
        for x in ids[1:]:
            concept_pairs.append({"a": ids[0], "b": x, "type": "concept-label"})
    concept = build_groups(concept_pairs, {"exact", "paraphrase", "concept", "concept-label"})

    def record(members: list[str], kind: str) -> dict:
        ms = sorted(members, key=lambda m: (paper_order(papers[by_id[m]["paperId"]]), by_id[m]["qno"]))
        pids = sorted({by_id[m]["paperId"] for m in ms}, key=lambda pid: paper_order(papers[pid]))
        years = sorted({papers[pid]["year"] for pid in pids if papers[pid].get("year")})
        within = [pid for pid, c in Counter(by_id[m]["paperId"] for m in ms).items() if c > 1]
        return {"id": "", "kind": kind, "members": ms, "canonical": ms[-1], "papers": pids, "distinctPapers": len(pids),
                "years": years, "distinctYears": len(years), "firstSeen": pids[0], "lastSeen": pids[-1], "withinPaperDuplicates": within,
                "concept": next((by_id[m]["concept"] for m in ms if by_id[m].get("concept")), None),
                "topic": by_id[ms[-1]]["classification"]["topic"], "subject": by_id[ms[-1]]["classification"]["subject"]}

    groups: dict[str, list[dict]] = {}
    for kind, gmap, prefix in (("exact", exact, "EX"), ("repeat", repeat, "RP"), ("concept", concept, "CC")):
        recs = [record(ms, kind) for ms in gmap.values()]
        recs.sort(key=lambda g: (-g["distinctPapers"], -len(g["members"]), g["members"][0]))
        for i, g in enumerate(recs, 1):
            g["id"] = f"{prefix}{i:04d}"
        groups[kind] = recs
    idx = {k: {m: g for g in groups[k] for m in g["members"]} for k in groups}
    pair_by_q = defaultdict(list)
    for p in pairs:
        if p["type"] in ("exact", "paraphrase", "concept"):
            pair_by_q[p["a"]].append(p)
            pair_by_q[p["b"]].append(p)
    for q in questions:
        po = paper_order(papers[q["paperId"]])
        eg, rg, cg = idx["exact"].get(q["id"]), idx["repeat"].get(q["id"]), idx["concept"].get(q["id"])
        rtype = "exact" if eg else "paraphrase" if rg else "concept" if cg else "unique"
        earlier_rep = [m for m in (rg["members"] if rg else []) if paper_order(papers[by_id[m]["paperId"]]) < po]
        earlier_con = [m for m in (cg["members"] if cg else []) if paper_order(papers[by_id[m]["paperId"]]) < po]
        within = [m for m in (rg["members"] if rg else []) if m != q["id"] and by_id[m]["paperId"] == q["paperId"]]
        q["repeat"] = {
            "type": rtype,
            "exactGroup": eg["id"] if eg else None,
            "repeatGroup": rg["id"] if rg else None,
            "conceptGroup": cg["id"] if cg else None,
            "distinctPapers": rg["distinctPapers"] if rg else 1,
            "conceptPapers": cg["distinctPapers"] if cg else 1,
            "novelty": "repeat-of-earlier" if earlier_rep else "new-variation-of-known-concept" if earlier_con else "first-appearance",
            "withinPaper": within,
            "matches": [
                {"id": p["b"] if p["a"] == q["id"] else p["a"], "type": p["type"], "method": p["method"], "scores": p["scores"], "reason": p["reason"]}
                for p in sorted(pair_by_q[q["id"]], key=lambda p: -p["scores"]["stem"])
            ][:10],
        }
    return {"pairs": pairs, "groups": groups}


def answer_objects(questions: list[dict], papers: dict[str, dict], groups: dict) -> list[dict]:
    by_id = {q["id"]: q for q in questions}
    rep_of = {m: g for g in groups["repeat"] for m in g["members"]}
    conflicts = []
    for q in questions:
        k = q["keyRaw"]
        cross = "none"
        g = rep_of.get(q["id"])
        if g and len(q["keyRaw"]) == 1 and not q["dropped"]:
            mine = q["options"][q["keyRaw"][0]]["text"]
            # only copies with the same option set can be compared key against key
            others = [by_id[m] for m in g["members"] if m != q["id"] and len(by_id[m]["keyRaw"]) == 1 and not by_id[m]["dropped"]
                      and option_sets_match(q, by_id[m])]
            if others:
                ok = all(same_answer(mine, o["options"][o["keyRaw"][0]]["text"]) for o in others)
                cross = "consistent" if ok else "conflict"
        ak = papers[q["paperId"]].get("answerKey", {})
        q["answer"] = {
            "indices": k,
            "label": "".join(LETTERS[i] for i in k) or None,
            "status": "dropped" if q["dropped"] else "keyed" if len(k) == 1 else "missing" if not k else "multiple",
            "source": ak.get("label", "Key marked in the source PDF"),
            "official": bool(ak.get("official")),
            "officialNote": q["officialNote"],
            "crossPaper": cross,
        }
        if cross == "conflict":
            conflicts.append(q["id"])
    return conflicts


# ------------------------------------------------------------------ notes

def compile_notes(questions: list[dict]) -> tuple[list[dict], dict[str, dict], list[str]]:
    plan = json.loads((NOTES / "plan.json").read_text())
    index, bodies, problems = [], {}, []
    count = Counter((q["classification"]["subject"], q["classification"]["topic"]) for q in questions)
    for p in plan:
        f = NOTES / f"{p['slug']}.json"
        entry = {k: p[k] for k in ("slug", "subject", "topic", "topicHi", "subtopics", "officialUnits", "outside41_26")}
        entry["pyqCount"] = count.get((p["subject"], p["topic"]), 0)
        if f.exists():
            try:
                note = json.loads(f.read_text())
            except Exception as e:
                problems.append(f"{f.name}: invalid JSON ({e})")
                note = None
            if note:
                covered = {s.get("subtopic") for s in note.get("sections", [])}
                missing = [s for s in p["subtopics"] if s not in covered]
                if missing:
                    problems.append(f"{p['slug']}: subtopics without a section: {missing}")
                entry |= {"available": True, "titleHi": note.get("titleHi") or p["topicHi"], "summary": note.get("summary", ""),
                          "sections": len(note.get("sections", [])), "flashcards": len(note.get("flashcards", [])),
                          "formulas": len(note.get("formulas", [])), "words": sum(len((s.get("body") or "").split()) for s in note.get("sections", []))}
                bodies[p["slug"]] = note
        else:
            entry["available"] = False
            problems.append(f"{p['slug']}: note not written yet")
        index.append(entry)
    return index, bodies, problems


# ------------------------------------------------------------------ main

def run(src: Path, web: Path, out_data: Path, out_reports: Path, copy_pdfs: bool, force: bool = False) -> dict:
    started = datetime.now(timezone.utc)
    manifest, records, papers, questions = load_all(src, web, force)
    ann, adjud, ann_errors = load_annotations()
    apply_transcriptions(questions, ann)
    exact0 = exact_groups(questions, web)[1]
    apply_annotations(questions, ann, exact0)
    rep = apply_repeats(questions, papers, adjud, web)
    conflicts = answer_objects(questions, papers, rep["groups"])
    qid_counts = Counter((q["paperId"], q["sourceQid"]) for q in questions if q.get("sourceQid"))
    verify.run(questions, papers, qid_counts)

    syllabus = syllabus_record(records)
    exam = exam_info()
    notes_index, notes, note_problems = compile_notes(questions)
    stats = reports.build_stats(questions, papers, rep, manifest)
    for p in papers.values():
        p["stats"] = stats["papers"].get(p["id"])
    sorted_papers = sorted(papers.values(), key=paper_order)
    vreport = reports.verification_report(questions, papers, manifest, ann_errors, note_problems, syllabus)

    # strip build-only fields before publishing
    for q in questions:
        for k in ("keyRaw", "dropped", "officialNote", "transcription"):
            q.pop(k, None)
    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "pipelineVersion": VERSION,
        "annotationsLoaded": len(ann),
        "adjudicationsLoaded": len(adjud),
        "taxonomy": TAXONOMY,
        "durationSec": round((datetime.now(timezone.utc) - started).total_seconds(), 1),
    }
    library = reports.library(manifest, papers, syllabus, questions)

    data_dir = web / "dsssb" / "data"
    (data_dir / "notes").mkdir(parents=True, exist_ok=True)
    compact = lambda path, obj: path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    compact(data_dir / "questions.json", questions)
    compact(data_dir / "papers.json", sorted_papers)
    compact(data_dir / "groups.json", rep["groups"])
    compact(data_dir / "stats.json", stats)
    compact(data_dir / "meta.json", meta)
    compact(data_dir / "exam.json", exam | {"syllabus": syllabus})
    compact(data_dir / "verification.json", vreport)
    compact(data_dir / "library.json", library)
    compact(data_dir / "notes" / "index.json", notes_index)
    for slug, body in notes.items():
        compact(data_dir / "notes" / f"{slug}.json", body)

    if copy_pdfs:
        dst = web / "dsssb" / "pdfs"
        dst.mkdir(parents=True, exist_ok=True)
        for e in manifest:
            if e["type"] == "pdf":
                s, d = src / e["relativePath"], dst / e["name"]
                if not d.exists() or d.stat().st_size != s.stat().st_size:
                    shutil.copy2(s, d)  # copy only; the originals are never modified

    out_data.mkdir(parents=True, exist_ok=True)
    pretty = lambda path, obj: path.write_text(json.dumps(obj, ensure_ascii=False, indent=1))
    pretty(out_data / "questions.json", questions)
    pretty(out_data / "papers.json", sorted_papers)
    pretty(out_data / "repeat_groups.json", rep["groups"])
    pretty(out_data / "matches.json", rep["pairs"])
    pretty(out_data / "pdf_manifest.json", manifest)
    pretty(out_data / "verification.json", vreport)
    reports.write_reports(out_reports, questions, sorted_papers, rep, stats, vreport, notes_index, exam, syllabus)
    return {"papers": len(papers), "questions": len(questions), "annotations": len(ann), "crossPaperConflicts": len(conflicts),
            "status": dict(Counter(q["verification"]["status"] for q in questions)), "annotationErrors": ann_errors, "noteProblems": len(note_problems)}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", required=True, help="folder with the source PDFs (searched recursively)")
    ap.add_argument("--web", default=str(ROOT / "public"))
    ap.add_argument("--data", default=str(ROOT / "data" / "dsssb"))
    ap.add_argument("--reports", default=str(ROOT / "reports" / "dsssb"))
    ap.add_argument("--no-copy-pdfs", action="store_true")
    ap.add_argument("--force", action="store_true", help="re-extract even if cached")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    res = run(Path(a.src), Path(a.web), Path(a.data), Path(a.reports), not a.no_copy_pdfs, a.force)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
