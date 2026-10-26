"""Statistics, the verification report and the Markdown/CSV reports."""
from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path

LETTERS = "ABCD"
STATUSES = ("verified", "corrected", "disputed", "unverified")


def _dist(items) -> dict:
    return dict(Counter(items).most_common())


def build_stats(questions: list[dict], papers: dict[str, dict], rep: dict, manifest: list[dict]) -> dict:
    by_paper = defaultdict(list)
    for q in questions:
        by_paper[q["paperId"]].append(q)
    paper_stats = {}
    for pid, qs in by_paper.items():
        paper_stats[pid] = {
            "questions": len(qs),
            "bySubject": _dist(q["classification"]["subject"] for q in qs),
            "byTopic": _dist(f"{q['classification']['subject']}|{q['classification']['topic']}" for q in qs),
            "byDifficulty": _dist(q["difficulty"] for q in qs),
            "byStatus": _dist(q["verification"]["status"] for q in qs),
            "repeated": sum(q["repeat"]["distinctPapers"] > 1 for q in qs),
            "conceptRepeated": sum(q["repeat"]["conceptPapers"] > 1 for q in qs),
            "dropped": sum(q["answer"]["status"] == "dropped" for q in qs),
            "explained": sum(bool(q.get("explanation")) for q in qs),
        }
    # topic weightage: how many questions per paper each topic gets, and in how many papers it appears
    n_papers = len(papers)
    doe = [pid for pid, p in papers.items() if p.get("departmentShort") == "DoE"]
    topic_rows = []
    tq = defaultdict(list)
    for q in questions:
        tq[(q["classification"]["subject"], q["classification"]["topic"])].append(q)
    for (subj, topic), qs in tq.items():
        per_paper = Counter(q["paperId"] for q in qs)
        per_year = Counter(papers[q["paperId"]]["year"] for q in qs)
        topic_rows.append({
            "subject": subj, "topic": topic, "questions": len(qs),
            "papersAsked": len(per_paper), "perPaper": round(len(qs) / n_papers, 2),
            "perDoePaper": round(sum(per_paper[p] for p in doe) / len(doe), 2) if doe else None,
            "byPaper": dict(per_paper), "byYear": {str(k): v for k, v in per_year.items()},
            "bySubtopic": _dist(q["classification"]["subtopic"] for q in qs),
            "repeatedQuestions": sum(q["repeat"]["distinctPapers"] > 1 for q in qs),
            "conceptRepeats": sum(q["repeat"]["conceptPapers"] > 1 for q in qs),
            "difficulty": _dist(q["difficulty"] for q in qs),
        })
    topic_rows.sort(key=lambda r: (-r["questions"], r["subject"], r["topic"]))
    years = defaultdict(lambda: {"papers": [], "questions": 0, "bySubject": Counter()})
    for pid, p in papers.items():
        y = years[str(p["year"])]
        y["papers"].append(pid)
        y["questions"] += len(by_paper[pid])
        y["bySubject"].update(q["classification"]["subject"] for q in by_paper[pid])
    by_year = {y: {"papers": v["papers"], "questions": v["questions"], "bySubject": dict(v["bySubject"]),
                   "bySubjectPerPaper": {k: round(c / len(v["papers"]), 1) for k, c in v["bySubject"].items()}} for y, v in sorted(years.items())}
    pdfs = [e for e in manifest if e["type"] == "pdf"]
    return {
        "totals": {
            "filesDiscovered": len(manifest),
            "pdfs": len(pdfs),
            "pdfsProcessed": sum(e["status"] in ("ok", "ocr") for e in pdfs),
            "pdfsFailed": sum(e["status"] not in ("ok", "ocr", "duplicate-file") for e in pdfs),
            "pages": sum(e.get("pages") or 0 for e in pdfs),
            "papers": n_papers,
            "questions": len(questions),
            "uniqueQuestions": len(questions) - sum(len(g["members"]) - 1 for g in rep["groups"]["exact"]),
            "years": len({p["year"] for p in papers.values()}),
            "exactGroups": len(rep["groups"]["exact"]),
            "repeatGroups": len(rep["groups"]["repeat"]),
            "conceptGroups": len(rep["groups"]["concept"]),
            "questionsInRepeatGroups": sum(len(g["members"]) for g in rep["groups"]["repeat"]),
            "dropped": sum(q["answer"]["status"] == "dropped" for q in questions),
            "explained": sum(bool(q.get("explanation")) for q in questions),
            "ocrQuestions": sum(q["textOrigin"] not in ("pdf-text-layer",) for q in questions),
        },
        "byStatus": _dist(q["verification"]["status"] for q in questions),
        "bySubject": _dist(q["classification"]["subject"] for q in questions),
        "byDifficulty": _dist(q["difficulty"] for q in questions),
        "byTextOrigin": _dist(q["textOrigin"] for q in questions),
        "byYear": by_year,
        "topics": topic_rows,
        "papers": paper_stats,
    }


def verification_report(questions, papers, manifest, ann_errors, note_problems, syllabus) -> dict:
    check_counts: dict[str, Counter] = defaultdict(Counter)
    for q in questions:
        for c in q["verification"]["checks"]:
            check_counts[c["id"]][c["result"]] += 1
    open_items = []
    corrections = []
    for q in questions:
        v = q["verification"]
        for c in v["corrections"]:
            corrections.append({"id": q["id"], "paperId": q["paperId"], "qno": q["qno"], **c})
        if v["status"] in ("verified", "corrected"):
            continue
        failing = [c for c in v["checks"] if c["result"] in ("fail", "warn")]
        open_items.append({
            "id": q["id"], "paperId": q["paperId"], "qno": q["qno"], "status": v["status"],
            "section": q["section"], "text": (q["text"] or q.get("textHi") or "")[:160],
            "sourceKey": q["answer"]["label"], "aiAnswer": (q.get("aiCheck") or {}).get("derivedLabel"),
            "aiConfidence": (q.get("aiCheck") or {}).get("confidence"),
            "failing": failing, "note": (q.get("aiCheck") or {}).get("note", ""), "evidence": v["evidence"],
        })
    open_items.sort(key=lambda x: (STATUSES.index(x["status"]), x["paperId"], x["qno"]))
    by_paper = {pid: dict(Counter(q["verification"]["status"] for q in questions if q["paperId"] == pid)) for pid in papers}
    return {
        "statusDefinitions": {
            "verified": "All checks passed: text from the PDF (or OCR confirmed against the page image), one key marked or an official DSSSB drop note, consistent metadata, and an independent AI solve agrees with the key.",
            "corrected": "As verified, but extracted text was corrected against the printed page. Every correction is listed with its evidence. Answer keys are never changed.",
            "disputed": "The key is in doubt: the AI solve disagrees or finds the question flawed, the same question is keyed differently elsewhere, or the key seen on the page image differs from the extracted one. The source key is still shown as the source key.",
            "unverified": "A check could not be completed (e.g. no AI review yet, OCR not reviewed, missing option text).",
        },
        "totals": dict(Counter(q["verification"]["status"] for q in questions)),
        "byPaper": by_paper,
        "checks": {k: dict(v) for k, v in check_counts.items()},
        "open": open_items,
        "corrections": corrections,
        "dropped": [{"id": q["id"], "paperId": q["paperId"], "qno": q["qno"], "note": q["answer"]["officialNote"]} for q in questions if q["answer"]["status"] == "dropped"],
        "metadata": [{"paperId": p["id"], "label": p["label"], "checks": p.get("metaChecks", []), "conflicts": p.get("metaConflicts", []),
                      "dateStatus": p.get("dateStatus"), "shiftStatus": p.get("shiftStatus"), "numbering": p.get("numbering")} for p in papers.values()],
        "files": [{k: e.get(k) for k in ("name", "status", "format", "pages", "questionsExtracted", "errors", "warnings")} for e in manifest],
        "syllabus": [{"part": "CS" if u in syllabus["csUnits"] else "Pedagogy", **u} for u in syllabus["csUnits"] + syllabus["pedagogyUnits"] if u["status"] != "ocr-confirmed"],
        "pipelineProblems": ann_errors + note_problems,
    }


def library(manifest, papers, syllabus, questions) -> list[dict]:
    pid_by_name = {p["pdf"]["name"]: p["id"] for p in papers.values()}
    out = []
    for e in manifest:
        pid = pid_by_name.get(e["name"])
        qs = [q for q in questions if q["paperId"] == pid] if pid else []
        out.append({
            "name": e["name"], "type": e["type"], "sizeBytes": e["sizeBytes"], "md5": e.get("md5"), "pages": e.get("pages"),
            "status": e["status"], "format": e.get("format"),
            "kind": "question-paper" if pid else ("syllabus" if e["name"] == syllabus.get("file") else "other"),
            "paperId": pid, "label": papers[pid]["label"] if pid else (syllabus["title"] if e["name"] == syllabus.get("file") else e["name"]),
            "questions": len(qs), "pagesWithoutQuestions": e.get("pagesWithoutQuestions", []), "errors": e.get("errors", []),
            "warnings": e.get("warnings", []), "verification": dict(Counter(q["verification"]["status"] for q in qs)),
            "url": f"dsssb/pdfs/{e['name']}",
        })
    return out


def _csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        path.write_text("")
        return
    keys = list(dict.fromkeys(k for r in rows for k in r))
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)


def write_reports(out: Path, questions, papers, rep, stats, vreport, notes_index, exam, syllabus) -> None:
    out.mkdir(parents=True, exist_ok=True)
    label = {p["id"]: p["label"] for p in papers}
    # ---------------- verification
    L = ["# DSSSB TGT Computer Science: verification report", ""]
    L += [f"- **{s}**: {vreport['totals'].get(s, 0)} questions — {vreport['statusDefinitions'][s]}" for s in STATUSES]
    L += ["", "## By paper", "", "| Paper | " + " | ".join(STATUSES) + " |", "|---|" + "---|" * len(STATUSES)]
    for p in papers:
        b = vreport["byPaper"].get(p["id"], {})
        L.append(f"| {p['label']} | " + " | ".join(str(b.get(s, 0)) for s in STATUSES) + " |")
    L += ["", "## Checks", "", "| Check | pass | warn | fail | n/a |", "|---|---|---|---|---|"]
    for cid, c in sorted(vreport["checks"].items()):
        L.append(f"| {cid} | {c.get('pass', 0)} | {c.get('warn', 0)} | {c.get('fail', 0)} | {c.get('na', 0)} |")
    L += ["", "## Paper metadata", ""]
    for m in vreport["metadata"]:
        L.append(f"- **{m['label']}**: date {m['dateStatus']}, shift {m['shiftStatus']}; " + "; ".join(f"{c['field']} {c['result']} ({c['detail']})" for c in m["checks"]))
    L += ["", f"## Officially dropped questions ({len(vreport['dropped'])})", ""]
    L += [f"- {label[d['paperId']]} Q{d['qno']}: {d['note']}" for d in vreport["dropped"]]
    L += ["", f"## Unresolved: disputed and unverified ({len(vreport['open'])})", ""]
    for o in vreport["open"]:
        fails = "; ".join(f"{c['id']}: {c['detail']}" for c in o["failing"])
        L.append(f"- **{o['status']}** · {label[o['paperId']]} Q{o['qno']} (`{o['id']}`) · source key {o['sourceKey'] or '-'} · AI {o['aiAnswer'] or '-'} ({o['aiConfidence'] or '-'})  \n  {o['text']}  \n  {fails}")
    L += ["", f"## Corrections with evidence ({len(vreport['corrections'])})", ""]
    for c in vreport["corrections"]:
        L.append(f"- {label[c['paperId']]} Q{c['qno']} · {c['field']}: `{(c['from'] or '')[:90]}` → `{(c['to'] or '')[:90]}` ({c['reason']}; {c['evidence']['pdf']} p.{c['evidence']['page']})")
    if vreport["syllabus"]:
        L += ["", "## Syllabus transcription corrections", ""]
        L += [f"- {u['part']} {u['n']}: OCR `{u['ocr']}` → `{u['text']}`" for u in vreport["syllabus"]]
    if vreport["pipelineProblems"]:
        L += ["", "## Pipeline problems", ""] + [f"- {x}" for x in vreport["pipelineProblems"]]
    (out / "verification_report.md").write_text("\n".join(L) + "\n")
    _csv(out / "verification_open.csv", [{k: v for k, v in o.items() if k not in ("failing", "evidence")} | {"failing": "; ".join(f"{c['id']}={c['result']}" for c in o["failing"])} for o in vreport["open"]])
    _csv(out / "corrections.csv", [{k: (v if k != "evidence" else f"{v['pdf']} p.{v['page']}") for k, v in c.items()} for c in vreport["corrections"]])

    # ---------------- analysis
    A = ["# DSSSB TGT Computer Science: PYQ analysis", "",
         f"{stats['totals']['questions']} questions from {stats['totals']['papers']} papers ({stats['totals']['pages']} PDF pages). "
         "The 2021 papers are five sets of post code 91/20 (DoE); 2023 is 39/22 (DoE); 2024 is 70/23 (NDMC, a different syllabus).", "",
         "## Year-wise (questions per paper by subject)", "", "| Year | Papers | " + " | ".join(stats["bySubject"]) + " |", "|---|---|" + "---|" * len(stats["bySubject"])]
    for y, v in stats["byYear"].items():
        A.append(f"| {y} | {len(v['papers'])} | " + " | ".join(str(v["bySubjectPerPaper"].get(s, 0)) for s in stats["bySubject"]) + " |")
    A += ["", "## Paper/shift-wise", "", "| Paper | Questions | Section B: CS | Teaching | Repeated | Dropped |", "|---|---|---|---|---|---|"]
    for p in papers:
        s = stats["papers"].get(p["id"], {})
        A.append(f"| {p['label']} | {s.get('questions')} | {s.get('bySubject', {}).get('Computer Science', 0)} | {s.get('bySubject', {}).get('Teaching Methodology', 0)} | {s.get('repeated')} | {s.get('dropped')} |")
    A += ["", "## Topic-wise weightage", "", "| Subject | Topic | Questions | Papers asked | Per paper | Repeated |", "|---|---|---|---|---|---|"]
    for t in stats["topics"]:
        A.append(f"| {t['subject']} | {t['topic']} | {t['questions']} | {t['papersAsked']}/{stats['totals']['papers']} | {t['perPaper']} | {t['repeatedQuestions']} |")
    (out / "analysis_report.md").write_text("\n".join(A) + "\n")
    _csv(out / "topic_stats.csv", [{k: v for k, v in t.items() if not isinstance(v, dict)} for t in stats["topics"]])

    # ---------------- repeats
    by_id = {q["id"]: q for q in questions}
    R = ["# Repeated questions", "", f"- Exact repeats: {len(rep['groups']['exact'])} groups",
         f"- Exact + paraphrased: {len(rep['groups']['repeat'])} groups", f"- Same concept: {len(rep['groups']['concept'])} groups", ""]
    for kind in ("repeat", "concept"):
        R += [f"## {kind.title()} groups", ""]
        for g in rep["groups"][kind]:
            if g["distinctPapers"] < 2:
                continue
            q = by_id[g["canonical"]]
            R.append(f"- **{g['id']}** · {g['distinctPapers']} papers · {g['topic']} · {g.get('concept') or ''}  \n  {(q['text'] or q.get('textHi') or '')[:140]}  \n  " + ", ".join(f"{label[by_id[m]['paperId']]} Q{by_id[m]['qno']}" for m in g["members"]))
        R.append("")
    (out / "repeat_report.md").write_text("\n".join(R) + "\n")

    # ---------------- question list
    _csv(out / "questions.csv", [{
        "id": q["id"], "paper": label[q["paperId"]], "qno": q["qno"], "section": q["section"],
        "subject": q["classification"]["subject"], "topic": q["classification"]["topic"], "subtopic": q["classification"]["subtopic"],
        "text": q["text"] or q.get("textHi"), **{f"option{o['label']}": o["text"] for o in q["options"]},
        "sourceKey": q["answer"]["label"], "answerStatus": q["answer"]["status"], "verification": q["verification"]["status"],
        "aiAnswer": (q.get("aiCheck") or {}).get("derivedLabel"), "difficulty": q["difficulty"], "repeatPapers": q["repeat"]["distinctPapers"],
        "pdf": q["source"]["pdf"], "page": q["source"]["page"], "textOrigin": q["textOrigin"],
    } for q in questions])
    N = ["# Study notes coverage", "", "| Subject | Topic | Note | Sections | Flashcards | PYQs |", "|---|---|---|---|---|---|"]
    for n in notes_index:
        N.append(f"| {n['subject']} | {n['topic']} | {'yes' if n.get('available') else 'missing'} | {n.get('sections', 0)} | {n.get('flashcards', 0)} | {n['pyqCount']} |")
    (out / "notes_coverage.md").write_text("\n".join(N) + "\n")
