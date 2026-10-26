"""Pipeline orchestrator.

    python -m stet.build --src /Users/apple/Documents/Stet

Stages: discover -> extract (cached per file hash) -> source corrections -> paper records ->
question records -> repeat detection -> annotation merge -> validation -> outputs.
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from rapidfuzz import fuzz

from . import PIPELINE_VERSION
from .extract import IMAGE_EXTS, discover, extract_pdf
from .normalize import norm
from .parsers.common import LABELS, clean_text
from .repeats import build_groups, find_pairs
from .taxonomy import SYLLABUS_SOURCE, TAXONOMY, UNCLASSIFIED, keyword_classify, section_subject, subtopic_exists, topic_exists
from . import reports, validate

log = logging.getLogger("stet.build")

ROOT = Path(__file__).resolve().parents[2]
PIPE = ROOT / "pipeline"
ANNOT = PIPE / "annotations"

KEY_SOURCES = {
    "bseb_question_paper": "Answer printed in the source paper ('Right Answer' / 'Right Option Id')",
    "bseb_sify_response_sheet": "'Correct Answer' field of the BSEB candidate response sheet (btet.sifyreg.com print-out)",
    "digialm_response_sheet": "Option marked correct (green tick) on the response sheet republished by Adda247",
}
FORMAT_LABEL = {
    "bseb_question_paper": "BSEB question paper with answers (Word export)",
    "bseb_sify_response_sheet": "Candidate response sheet, bilingual EN/HI (Telegram-watermarked print-out)",
    "digialm_response_sheet": "Candidate response sheet (Adda247 republication)",
}


# ---------------------------------------------------------------------------
# papers
# ---------------------------------------------------------------------------
def make_paper(rec: dict) -> dict:
    meta = rec.get("meta", {})
    name = rec["file"]["name"]
    conflicts: list[str] = []
    date = meta.get("date")
    year = int(date[:4]) if date else None
    if year is None and (m := re.search(r"(20\d{2})", name)):
        year = int(m.group(1))
        conflicts.append("exam date not found inside PDF; year taken from filename")
    shift = meta.get("shift")
    shift_source = meta.get("shiftSource")
    fn_shift = None
    if m := re.search(r"shift[-_ ]?(\d)", name, re.I):
        fn_shift = int(m.group(1))
    if shift is not None and not (1 <= shift <= 9):
        conflicts.append(f"header prints shift '{shift}' (apparent typo); shift {fn_shift} taken from filename")
        shift, shift_source = fn_shift, "Filename (header value was malformed)"
    if shift is None and fn_shift is not None:
        shift, shift_source = fn_shift, "Filename"
    if fn_shift is not None and shift is not None and fn_shift != shift:
        conflicts.append(f"filename says shift-{fn_shift} but the document says shift {shift} on {date}; the document value is used")

    fmt = rec.get("format")
    if year == 2024:
        session = "STET 2024 (First)" if meta.get("examEdition") == "First" else "STET 2024"
    else:
        session = f"STET {year}" if year else "STET (year unknown)"
    pid = f"{date or year}-S{shift if shift else 'X'}"
    d = datetime.strptime(date, "%Y-%m-%d") if date else None
    label = f"{session} · {d.strftime('%d %b %Y') if d else 'date n/a'} · Shift {shift if shift else 'n/a'}"
    return {
        "id": pid,
        "label": label,
        "shortLabel": f"{d.strftime('%d %b %y') if d else year} S{shift if shift else '?'}",
        "exam": "Bihar STET",
        "board": "Bihar School Examination Board",
        "session": session,
        "year": year,
        "date": date,
        "dateSource": meta.get("dateSource", "Not available"),
        "shift": shift,
        "shiftSource": shift_source or "Not available",
        "timeStart": meta.get("timeStart"),
        "timeEnd": meta.get("timeEnd"),
        "paper": "Paper II (Classes 11-12)",
        "paperSource": meta.get("paper") or (meta.get("headerTitle") or "").replace("\n", " ") or "Not available",
        "subject": meta.get("subjectName") or "Computer Science",
        "subjectCode": meta.get("subjectCode") or "Not available",
        "sourceFormat": fmt,
        "sourceFormatLabel": FORMAT_LABEL.get(fmt, "Unknown"),
        "answerKeySource": KEY_SOURCES.get(fmt, "Not available"),
        "metaConflicts": conflicts,
        "pdf": {"name": name, "md5": rec["file"]["md5"], "pages": rec["file"].get("pages"), "url": f"pdfs/{pid}.pdf"},
    }


# ---------------------------------------------------------------------------
# questions
# ---------------------------------------------------------------------------
QTYPE_RULES = [
    ("assertion-reason", re.compile(r"assertion|reason\s*\(r\)", re.I)),
    ("match-the-following", re.compile(r"\bmatch (the )?(following|list)|list[- ]?i\b", re.I)),
    ("statement-based", re.compile(r"statements?\b.*\b(correct|true|incorrect|false)|which of the (above|following) statements|is/are (correct|true)", re.I)),
    ("sequence/ordering", re.compile(r"\barrange\b|\bchronolog|\bcorrect order|\bsequence of\b|right order|increasing order|descending order", re.I)),
    ("negative (NOT/incorrect)", re.compile(r"\bnot\b|\bincorrect\b|\bfalse\b|\bexcept\b", re.I)),
    ("fill-in-the-blank", re.compile(r"_{3,}|-{5,}|‐{5,}|\.{4,}|…{2,}")),
    ("numerical/problem-solving", re.compile(r"\d.*(how many|calculate|find|value|result|minimum|maximum|number of|sum|output)|Σ|=\s*\d", re.I)),
    ("abbreviation/full-form", re.compile(r"stands? for|full form|abbreviation|acronym", re.I)),
]


def question_type(text: str, has_figure: bool) -> str:
    if has_figure:
        return "figure-based"
    if re.search(r"printf|cout|#include|def |int main|\{\s*\n|;\s*\n.*;", text):
        return "code-based"
    for name, rx in QTYPE_RULES:
        if rx.search(text):
            return name
    return "direct/conceptual"


def load_corrections() -> dict:
    p = ANNOT / "source_corrections.json"
    return {k: v for k, v in json.loads(p.read_text()).items() if not k.startswith("_")} if p.exists() else {}


def make_questions(rec: dict, paper: dict, corrections: dict) -> list[dict]:
    out = []
    md5 = rec["file"]["md5"]
    for rq in rec["questions"]:
        qno = rq["qno"]
        qid = f"{paper['id']}-Q{qno:03d}"
        issues = list(rq.get("issues", []))
        text, text_hi = rq["text"] or "", rq.get("text_hi")
        opts = [{"label": o["label"], "text": clean_text(o["text"]), "textHi": o.get("text_hi")} for o in rq["options"]]
        corr = corrections.get(f"{md5[:8]}:{qno}")
        text_origin = "pdf-text-layer"
        if corr:
            text = corr.get("text", text)
            text_hi = corr.get("textHi", text_hi)
            if "options" in corr:
                for o, t in zip(opts, corr["options"]):
                    o["textInSource"] = o["text"]
                    o["text"] = t
                    o["textHi"] = None  # the source's Hindi slot only says "option X is correct"
            text_origin = corr.get("method", "manual-correction")
            if corr.get("optionsNote"):
                issues.append(corr["optionsNote"])
        for o in opts:
            if not o["text"].strip():
                o["text"] = ""
                issues.append(f"option {o['label']} is blank in the source PDF")
        ans_idx = rq.get("answer_index")
        sec = rq.get("section")
        figures = [{"file": f"figures/{f['file']}", "page": f["page"]} for f in rq.get("figures", []) if f.get("file")]
        if not text.strip() and not figures:
            issues.append("question text missing")
        elif not text.strip():
            issues.append("question text is an image without a text layer (not transcribed)")
        out.append({
            "id": qid,
            "paperId": paper["id"],
            "qno": qno,
            "sourceQuestionId": rq.get("source_qid"),
            "section": sec or ("Part I" if qno <= 100 else "Part II" if qno <= 130 else "Part III"),
            "sectionSubject": section_subject(qno),
            "text": text,
            "textHi": text_hi,
            "textOrigin": text_origin,
            "options": opts,
            "answer": {
                "index": ans_idx,
                "label": LABELS[ans_idx] if ans_idx is not None else None,
                "source": "source-key" if ans_idx is not None else "none",
                "sourceDetail": paper["answerKeySource"] if ans_idx is not None else "No answer key in source",
                "textInSource": rq.get("answer_text_in_source"),
            },
            "source": {"pdf": paper["pdf"]["name"], "pdfUrl": paper["pdf"]["url"], "page": rq["page"], "pageEnd": rq["page_end"]},
            "figures": figures,
            "hasFigure": bool(figures),
            "hindiFixes": rq.get("hindi_fixes", []),
            "extractionIssues": issues,
        })
    return out


# ---------------------------------------------------------------------------
# annotations (AI-assisted topic / difficulty / explanation / answer check)
# ---------------------------------------------------------------------------
def load_annotations() -> tuple[dict, list[dict], dict]:
    ann: dict[str, dict] = {}
    adjud: list[dict] = []
    concepts: dict = {}
    d = ANNOT / "ai"
    if not d.exists():
        return ann, adjud, concepts
    for f in sorted(d.glob("annot_*.json")):
        try:
            for a in json.loads(f.read_text()):
                ann[a["id"]] = a | {"_file": f.name}
        except Exception as e:
            log.error("bad annotation file %s: %s", f, e)
    for f in sorted(d.glob("pairs_*.json")):
        try:
            adjud += json.loads(f.read_text())
        except Exception as e:
            log.error("bad adjudication file %s: %s", f, e)
    cf = d / "concepts.json"
    if cf.exists():
        concepts = json.loads(cf.read_text())
    return ann, adjud, concepts


def _map_letter(src_q: dict, letter: str | None, dst_q: dict) -> int | None:
    """Translate an answer letter given for src_q's option order into dst_q's option index."""
    if letter is None or letter not in LABELS:
        return None
    si = LABELS.index(letter)
    if si >= len(src_q["options"]):
        return None
    t = norm(src_q["options"][si]["text"])
    scores = [fuzz.ratio(t, norm(o["text"])) for o in dst_q["options"]]
    best = max(range(len(scores)), key=lambda i: scores[i]) if scores else None
    return best if best is not None and scores[best] >= 85 else None


def apply_annotations(questions: list[dict], exact_groups: dict[str, list[str]], ann: dict, concepts: dict) -> None:
    by_id = {q["id"]: q for q in questions}
    member_to_group = {m: g for g, ms in exact_groups.items() for m in ms}
    for q in questions:
        a = ann.get(q["id"])
        src = q
        if a is None and q["id"] in member_to_group:
            for m in exact_groups[member_to_group[q["id"]]]:
                if m in ann:
                    a, src = ann[m], by_id[m]
                    break
        subj = q["sectionSubject"]
        if a:
            subject = a.get("subject") or subj
            topic, subtopic = a.get("topic"), a.get("subtopic")
            ok = topic_exists(subject, topic) and (subtopic_exists(subject, topic, subtopic) or not subtopic)
            q["classification"] = {
                "subject": subject, "topic": topic if ok else UNCLASSIFIED, "subtopic": subtopic if ok else UNCLASSIFIED,
                "method": "ai-assisted" if ok else "ai-label-outside-taxonomy",
            }
            if not ok:
                q["extractionIssues"].append(f"annotation topic outside taxonomy: {subject} / {topic} / {subtopic}")
            raw_concept = (a.get("concept") or "").strip()
            canon = concepts.get("map", {}).get(raw_concept, raw_concept)
            q["concept"] = canon or None
            q["difficulty"] = a.get("difficulty") if a.get("difficulty") in ("easy", "medium", "hard") else "not rated"
            q["difficultyMethod"] = "ai-assessed"
            q["explanation"] = {"text": a.get("explanation") or "", "origin": "ai-generated", "annotatedFrom": src["id"]}
            d_idx = _map_letter(src, a.get("derivedAnswer"), q)
            q["aiCheck"] = {
                "derivedIndex": d_idx,
                "derivedLabel": LABELS[d_idx] if d_idx is not None else None,
                "confidence": a.get("derivedConfidence"),
                "assessment": a.get("keyAssessment"),
                "note": a.get("keyNote") or "",
            }
        else:
            kc = keyword_classify(subj, q["text"] + " " + " ".join(o["text"] for o in q["options"]))
            if kc:
                q["classification"] = {"subject": subj, "topic": kc[0], "subtopic": kc[1], "method": "keyword-rule"}
            else:
                q["classification"] = {"subject": subj, "topic": UNCLASSIFIED, "subtopic": UNCLASSIFIED, "method": "none"}
            q["concept"] = None
            q["difficulty"] = "not rated"
            q["difficultyMethod"] = "none"
            q["explanation"] = None
            q["aiCheck"] = None


def answer_status(questions: list[dict], exact_groups: dict[str, list[str]]) -> list[dict]:
    """Combine source key, AI check and cross-paper consistency into one verification label."""
    by_id = {q["id"]: q for q in questions}
    conflicts = []
    member_to_group = {m: g for g, ms in exact_groups.items() for m in ms}
    for q in questions:
        key = q["answer"]["index"]
        notes = []
        cross = "none"
        if q["id"] in member_to_group:
            texts = {}
            for m in exact_groups[member_to_group[q["id"]]]:
                mq = by_id[m]
                if mq["answer"]["index"] is not None:
                    texts[m] = norm(mq["options"][mq["answer"]["index"]]["text"])
            if len(set(texts.values())) > 1:
                cross = "conflict"
                notes.append("the same question is keyed differently in another paper")
            elif len(texts) > 1:
                cross = "consistent"
        ai = q.get("aiCheck")
        if key is None:
            status = "unavailable" if not ai or ai["derivedIndex"] is None else "ai-derived-only"
        elif ai is None:
            status = "source-key-unchecked" if cross != "conflict" else "disputed"
        elif ai["derivedIndex"] is None:
            # the reviewer looked at it but found no option it could defend
            status = "ambiguous" if cross != "conflict" else "disputed"
            notes.append("AI review found no option it could confirm as correct")
        elif ai.get("assessment") == "ambiguous" and cross != "conflict":
            status = "ambiguous"
            notes.append("AI review flags the question as ambiguous or flawed")
        elif ai["derivedIndex"] == key and cross != "conflict":
            status = "verified"
        else:
            status = "disputed"
            if ai["derivedIndex"] != key:
                notes.append(f"independent AI check gives option {ai['derivedLabel']}, source key gives {q['answer']['label']}")
        q["answer"]["crossPaper"] = cross
        q["answer"]["status"] = status
        q["answer"]["notes"] = notes
        if status in ("disputed", "ambiguous"):
            conflicts.append({"id": q["id"], "status": status, "key": q["answer"]["label"], "ai": ai["derivedLabel"] if ai else None,
                              "aiConfidence": ai["confidence"] if ai else None, "crossPaper": cross, "notes": notes, "aiNote": ai["note"] if ai else ""})
    return conflicts


# ---------------------------------------------------------------------------
# repeats
# ---------------------------------------------------------------------------
def paper_order(p: dict) -> tuple:
    return (p["date"] or "9999", p["shift"] or 9)


def apply_repeats(questions: list[dict], papers: dict[str, dict], adjud: list[dict]) -> dict:
    pairs = find_pairs(questions)
    # merge review adjudications (AI-assisted review of borderline pairs)
    verdicts = {}
    for v in adjud:
        verdicts[tuple(sorted((v["a"], v["b"])))] = v
    for p in pairs:
        if p["type"] != "review":
            continue
        v = verdicts.get(tuple(sorted((p["a"], p["b"]))))
        if v and v.get("verdict") in ("paraphrase", "concept", "different"):
            p["type"] = {"paraphrase": "paraphrase", "concept": "concept", "different": "different"}[v["verdict"]]
            p["method"] = "ai-adjudicated"
            p["reason"] = v.get("reason") or p["reason"]
    by_id = {q["id"]: q for q in questions}

    exact = build_groups(pairs, {"exact"})
    repeat = build_groups(pairs, {"exact", "paraphrase"})
    # concept groups: adjudicated same-concept pairs + identical canonical concept labels across papers
    concept_pairs = [p for p in pairs if p["type"] in ("exact", "paraphrase", "concept")]
    by_concept = defaultdict(list)
    for q in questions:
        if q.get("concept"):
            by_concept[(q["classification"]["subject"], q["concept"].lower())].append(q["id"])
    for (_, c), ids in by_concept.items():
        for x in ids[1:]:
            concept_pairs.append({"a": ids[0], "b": x, "type": "concept-label"})
    concept = build_groups(concept_pairs, {"exact", "paraphrase", "concept", "concept-label"})

    def group_record(gid: str, members: list[str], kind: str) -> dict:
        ms = sorted(members, key=lambda m: (paper_order(papers[by_id[m]["paperId"]]), by_id[m]["qno"]))
        pids = sorted({by_id[m]["paperId"] for m in ms}, key=lambda pid: paper_order(papers[pid]))
        sessions = sorted({papers[pid]["session"] for pid in pids})
        years = sorted({papers[pid]["year"] for pid in pids})
        same_paper_dupes = [pid for pid, c in Counter(by_id[m]["paperId"] for m in ms).items() if c > 1]
        canon = ms[-1]  # latest appearance is shown as the canonical wording
        return {
            "id": gid, "kind": kind, "members": ms, "canonical": canon,
            "papers": pids, "distinctPapers": len(pids), "sessions": sessions, "distinctSessions": len(sessions), "years": years,
            "firstSeen": pids[0], "lastSeen": pids[-1], "withinPaperDuplicates": same_paper_dupes,
        }

    groups = {"exact": [], "repeat": [], "concept": []}
    for kind, gmap, prefix in (("exact", exact, "EX"), ("repeat", repeat, "RP"), ("concept", concept, "CC")):
        recs = [group_record("", ms, kind) for ms in gmap.values()]
        recs.sort(key=lambda g: (-g["distinctPapers"], -len(g["members"]), g["members"][0]))
        for i, g in enumerate(recs, 1):
            g["id"] = f"{prefix}{i:04d}"
        groups[kind] = recs

    # per-question repeat info
    idx = {k: {m: g for g in groups[k] for m in g["members"]} for k in groups}
    pair_by_q = defaultdict(list)
    for p in pairs:
        if p["type"] in ("exact", "paraphrase", "concept"):
            pair_by_q[p["a"]].append(p)
            pair_by_q[p["b"]].append(p)
    for q in questions:
        po = paper_order(papers[q["paperId"]])
        eg, rg, cg = idx["exact"].get(q["id"]), idx["repeat"].get(q["id"]), idx["concept"].get(q["id"])
        if eg:
            rtype = "exact"
        elif rg:
            rtype = "paraphrase"
        elif cg:
            rtype = "concept"
        else:
            rtype = "unique"
        earlier_rep = [m for m in (rg["members"] if rg else []) if paper_order(papers[by_id[m]["paperId"]]) < po]
        earlier_con = [m for m in (cg["members"] if cg else []) if paper_order(papers[by_id[m]["paperId"]]) < po]
        if earlier_rep:
            novelty = "repeat-of-earlier"
        elif earlier_con:
            novelty = "new-variation-of-known-concept"
        else:
            novelty = "first-appearance"
        q["repeat"] = {
            "type": rtype,
            "exactGroup": eg["id"] if eg else None,
            "repeatGroup": rg["id"] if rg else None,
            "conceptGroup": cg["id"] if cg else None,
            "distinctPapers": rg["distinctPapers"] if rg else 1,
            "conceptPapers": cg["distinctPapers"] if cg else 1,
            "novelty": novelty,
            "matches": [
                {"id": p["b"] if p["a"] == q["id"] else p["a"], "type": p["type"], "method": p["method"], "scores": p["scores"], "reason": p["reason"]}
                for p in sorted(pair_by_q[q["id"]], key=lambda p: -p["scores"]["stem"])
            ][:12],
        }
    return {"pairs": pairs, "groups": groups, "exactMap": {g["id"]: g["members"] for g in groups["exact"]}}


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def run(src: Path, out_web: Path, out_data: Path, out_reports: Path, force: bool = False, copy_pdfs: bool = False) -> dict:
    started = datetime.now(timezone.utc)
    cache = PIPE / "cache"
    figs = out_web / "figures"
    files = discover(src)
    manifest, records = [], []
    for f in files:
        entry = {"name": f.name, "relativePath": str(f.relative_to(src)), "sizeBytes": f.stat().st_size, "type": f.suffix.lower().lstrip(".")}
        if f.suffix.lower() == ".pdf":
            log.info("extracting %s", f.name)
            rec = extract_pdf(f, cache, figs, force=force)
            entry |= {
                "md5": rec["file"]["md5"], "pages": rec["file"].get("pages"), "status": rec["status"], "format": rec.get("format"),
                "questionsExtracted": len(rec["questions"]), "errors": rec["errors"], "warnings": rec.get("warnings", []),
                "emptyTextPages": rec.get("emptyTextPages", []), "pagesWithoutQuestions": rec.get("pagesWithoutQuestions", []),
                "fromCache": rec.get("fromCache", False),
            }
            records.append(rec)
        elif f.suffix.lower() in IMAGE_EXTS:
            entry |= {"status": "reference-image", "note": "Not a question paper. Used as the syllabus/exam-pattern reference (see taxonomy)." if "syllabus" in f.name.lower() else "Image file; not processed"}
        else:
            entry |= {"status": "skipped", "note": "not a PDF"}
        manifest.append(entry)

    # duplicate files by hash
    seen: dict[str, str] = {}
    for e in manifest:
        if e.get("md5"):
            if e["md5"] in seen:
                e["duplicateOf"] = seen[e["md5"]]
                e["status"] = "duplicate-file"
            else:
                seen[e["md5"]] = e["name"]

    duplicate_paths = {src / e["relativePath"] for e in manifest if e.get("duplicateOf")}
    corrections = load_corrections()
    papers: dict[str, dict] = {}
    questions: list[dict] = []
    for rec in records:
        if rec["status"] != "ok" or Path(rec["file"]["path"]) in duplicate_paths:
            continue
        p = make_paper(rec)
        if p["id"] in papers:
            p["metaConflicts"].append(f"another PDF already maps to paper id {p['id']}")
            p["id"] += "-dup"
        papers[p["id"]] = p
        qs = make_questions(rec, p, corrections)
        p["questionCount"] = len(qs)
        p["sections"] = [{"name": k, "count": v} for k, v in Counter(q["section"] for q in qs).items()]
        questions += qs
        for e in manifest:
            if e.get("md5") == rec["file"]["md5"] and not e.get("duplicateOf"):
                e["paperId"] = p["id"]

    ann, adjud, concepts = load_annotations()
    # repeats first pass (needs only text) -> exact groups used to propagate annotations
    for q in questions:
        q["norm"] = norm(q["text"])
        q["qtype"] = question_type(q["text"], q["hasFigure"])
    rep0 = apply_repeats(questions, papers, adjud)
    apply_annotations(questions, rep0["exactMap"], ann, concepts)
    rep = apply_repeats(questions, papers, adjud)  # second pass picks up concept labels
    key_conflicts = answer_status(questions, rep["exactMap"])

    # duplicate papers: share of questions with an exact match in another paper
    paper_overlap = reports.paper_overlap(questions, papers)
    for (a, b), v in paper_overlap.items():
        if v["exactShare"] >= 0.8:
            papers[a]["metaConflicts"].append(f"possible duplicate of paper {b} ({v['exactShare']:.0%} identical questions)")

    for q in questions:
        q.pop("norm", None)
    issues = validate.run(questions, papers, manifest, rep)

    out_web.mkdir(parents=True, exist_ok=True)
    data_dir = out_web / "data"
    data_dir.mkdir(exist_ok=True)
    if copy_pdfs:
        (out_web / "pdfs").mkdir(exist_ok=True)
        for p in papers.values():
            srcf = next(f for f in files if f.name == p["pdf"]["name"])
            dst = out_web / p["pdf"]["url"]
            if not dst.exists() or dst.stat().st_size != srcf.stat().st_size:
                shutil.copy2(srcf, dst)  # copy only - originals are never modified

    stats = reports.build_stats(questions, papers, rep, manifest, issues, key_conflicts)
    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "pipelineVersion": PIPELINE_VERSION,
        "sourceDir": str(src),
        "annotationsLoaded": len(ann),
        "adjudicationsLoaded": len(adjud),
        "syllabus": SYLLABUS_SOURCE,
        "taxonomy": TAXONOMY,
        "durationSec": round((datetime.now(timezone.utc) - started).total_seconds(), 1),
    }
    sorted_papers = sorted(papers.values(), key=paper_order)
    write = lambda path, obj: path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    write(data_dir / "questions.json", questions)
    write(data_dir / "papers.json", sorted_papers)
    write(data_dir / "groups.json", rep["groups"])
    write(data_dir / "stats.json", stats)
    # the published app gets no local paths; the full record stays in data/ and reports/
    write(data_dir / "meta.json", {k: v for k, v in meta.items() if k != "sourceDir"})
    for stale in ("manifest.json", "quality.json"):
        (data_dir / stale).unlink(missing_ok=True)

    out_data.mkdir(parents=True, exist_ok=True)
    pretty = lambda path, obj: path.write_text(json.dumps(obj, ensure_ascii=False, indent=1))
    pretty(out_data / "questions.json", questions)
    pretty(out_data / "papers.json", sorted_papers)
    pretty(out_data / "repeat_groups.json", rep["groups"])
    pretty(out_data / "matches.json", rep["pairs"])
    pretty(out_data / "pdf_manifest.json", manifest)
    pretty(out_data / "quality.json", {"issues": issues, "keyConflicts": key_conflicts,
                                       "reviewPairs": [p for p in rep["pairs"] if p["type"] == "review"]})
    reports.write_reports(out_reports, questions, sorted_papers, rep, manifest, issues, key_conflicts, stats, meta, paper_overlap)
    return {"papers": len(papers), "questions": len(questions), "stats": stats["totals"]}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", default="/Users/apple/Documents/Stet")
    ap.add_argument("--web", default=str(ROOT / "public"))
    ap.add_argument("--data", default=str(ROOT / "data"))
    ap.add_argument("--reports", default=str(ROOT / "reports"))
    ap.add_argument("--force", action="store_true", help="ignore the extraction cache")
    ap.add_argument("--copy-pdfs", action="store_true", help="also copy the PDFs to public/pdfs (not used by the app)")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    src = Path(a.src)
    if not src.is_dir():
        log.error("source directory not found: %s", src)
        return 2
    res = run(src, Path(a.web), Path(a.data), Path(a.reports), force=a.force, copy_pdfs=a.copy_pdfs)
    print(json.dumps(res, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
