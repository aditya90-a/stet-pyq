"""Stage 6: statistics and human-readable reports (Markdown + CSV).  All numbers are computed from
the extracted dataset."""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path


def paper_overlap(questions: list[dict], papers: dict[str, dict]) -> dict[tuple[str, str], dict]:
    by_id = {q["id"]: q for q in questions}
    res = {}
    by_paper = defaultdict(list)
    for q in questions:
        by_paper[q["paperId"]].append(q)
    for a, b in combinations(sorted(papers), 2):
        for x, y in ((a, b), (b, a)):
            qs = by_paper[x]
            ex = sum(1 for q in qs if any(m["type"] == "exact" and by_id[m["id"]]["paperId"] == y for m in q.get("repeat", {}).get("matches", [])))
            pa = sum(1 for q in qs if any(m["type"] == "paraphrase" and by_id[m["id"]]["paperId"] == y for m in q.get("repeat", {}).get("matches", [])))
            res[(x, y)] = {"exact": ex, "paraphrase": pa, "total": len(qs), "exactShare": ex / len(qs) if qs else 0}
    return res


def _dist(items) -> dict:
    return dict(Counter(items).most_common())


def paper_stats(qs: list[dict], papers: dict[str, dict]) -> dict:
    n = len(qs)
    rep = [q for q in qs if q["repeat"]["repeatGroup"] and q["repeat"]["distinctPapers"] > 1]
    return {
        "questions": n,
        "bySubject": _dist(q["classification"]["subject"] for q in qs),
        "byTopic": _dist(f"{q['classification']['subject']} › {q['classification']['topic']}" for q in qs),
        "byDifficulty": _dist(q["difficulty"] for q in qs),
        "byType": _dist(q["qtype"] for q in qs),
        "repeated": len(rep),
        "repeatedPct": round(100 * len(rep) / n, 1) if n else 0,
        "exactRepeats": sum(1 for q in qs if q["repeat"]["type"] == "exact"),
        "paraphrasedRepeats": sum(1 for q in qs if q["repeat"]["type"] == "paraphrase"),
        "conceptRepeats": sum(1 for q in qs if q["repeat"]["type"] == "concept"),
        "novelty": _dist(q["repeat"]["novelty"] for q in qs),
        "answerStatus": _dist(q["answer"]["status"] for q in qs),
        "keyCoverage": sum(1 for q in qs if q["answer"]["index"] is not None),
        "issues": sum(1 for q in qs if q["extractionIssues"]),
    }


def build_stats(questions, papers, rep, manifest, issues, key_conflicts) -> dict:
    pdfs = [e for e in manifest if e.get("type") == "pdf"]
    by_paper = defaultdict(list)
    for q in questions:
        by_paper[q["paperId"]].append(q)
    groups = rep["groups"]
    multi = [g for g in groups["repeat"] if g["distinctPapers"] > 1]
    singles = sum(1 for q in questions if not q["repeat"]["repeatGroup"])
    totals = {
        "filesDiscovered": len(manifest),
        "pdfsDiscovered": len(pdfs),
        "pdfsProcessed": sum(1 for e in pdfs if e.get("status") == "ok"),
        "pdfsFailed": sum(1 for e in pdfs if e.get("status") not in ("ok", "duplicate-file")),
        "duplicateFiles": sum(1 for e in manifest if e.get("status") == "duplicate-file"),
        "questions": len(questions),
        "uniqueQuestions": singles + len(groups["repeat"]),
        "uniqueAfterExactOnly": len(questions) - sum(len(g["members"]) - 1 for g in groups["exact"]),
        "papers": len(papers),
        "years": len({p["year"] for p in papers.values()}),
        "sessions": len({p["session"] for p in papers.values()}),
        "examDays": len({p["date"] for p in papers.values()}),
        "shifts": len({(p["date"], p["shift"]) for p in papers.values()}),
        "repeatGroups": len(multi),
        "exactGroups": sum(1 for g in groups["exact"] if g["distinctPapers"] > 1),
        "paraphraseGroups": sum(1 for g in multi if any(m not in {x for e in groups["exact"] for x in e["members"]} for m in g["members"])),
        "conceptGroups": sum(1 for g in groups["concept"] if g["distinctPapers"] > 1),
        "questionsInRepeatGroups": sum(len(g["members"]) for g in multi),
        "crossSessionGroups": sum(1 for g in multi if g["distinctSessions"] > 1),
        "keyConflicts": len(key_conflicts),
        "reviewPairsPending": sum(1 for p in rep["pairs"] if p["type"] == "review"),
        "issuesBySeverity": _dist(i["severity"] for i in issues),
        "pagesTotal": sum(e.get("pages") or 0 for e in pdfs),
    }
    return {
        "totals": totals,
        "bySubject": _dist(q["classification"]["subject"] for q in questions),
        "byTopic": _dist(f"{q['classification']['subject']} › {q['classification']['topic']}" for q in questions),
        "byDifficulty": _dist(q["difficulty"] for q in questions),
        "byType": _dist(q["qtype"] for q in questions),
        "answerStatus": _dist(q["answer"]["status"] for q in questions),
        "classificationMethod": _dist(q["classification"]["method"] for q in questions),
        "explanations": sum(1 for q in questions if q.get("explanation")),
        "papers": {pid: paper_stats(qs, papers) for pid, qs in by_paper.items()},
    }


# ---------------------------------------------------------------------------
def _csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        path.write_text("")
        return
    with open(path, "w", newline="", encoding="utf-8-sig") as f:  # BOM so Excel shows Hindi correctly
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def write_reports(out: Path, questions, papers, rep, manifest, issues, key_conflicts, stats, meta, overlap) -> None:
    out.mkdir(parents=True, exist_ok=True)
    pmap = {p["id"]: p for p in papers}
    by_id = {q["id"]: q for q in questions}
    t = stats["totals"]

    # ---------------- processing report ----------------
    L = ["# PDF processing report", "", f"Generated: {meta['generatedAt']} · pipeline v{meta['pipelineVersion']} · source: `{meta['sourceDir']}`", "",
         "| Metric | Value |", "|---|---|"]
    for k in ("filesDiscovered", "pdfsDiscovered", "pdfsProcessed", "pdfsFailed", "duplicateFiles", "pagesTotal", "questions", "uniqueAfterExactOnly", "uniqueQuestions", "papers"):
        L.append(f"| {k} | {t[k]} |")
    L += ["", "## Files", "", "| File | Status | Format | Pages | Questions | Paper ID | Notes |", "|---|---|---|---|---|---|---|"]
    for e in manifest:
        notes = "; ".join((e.get("errors") or []) + (e.get("warnings") or []) + ([e["note"]] if e.get("note") else []))
        if e.get("pagesWithoutQuestions"):
            notes += f" pages without questions (covers/adverts): {e['pagesWithoutQuestions']}"
        L.append(f"| {e['name']} | {e.get('status')} | {e.get('format') or '-'} | {e.get('pages') or '-'} | {e.get('questionsExtracted', '-')} | {e.get('paperId', '-')} | {notes} |")
    L += ["", "## Paper metadata", "", "| Paper ID | Date | Shift | Shift source | Time | Subject code | Answer key source | Conflicts |", "|---|---|---|---|---|---|---|---|"]
    for p in papers:
        L.append(f"| {p['id']} | {p['date']} | {p['shift']} | {p['shiftSource']} | {p['timeStart']}–{p['timeEnd']} | {p['subjectCode']} | {p['answerKeySource']} | {'; '.join(p['metaConflicts']) or '-'} |")
    L += ["", "## Validation findings", "", "| Severity | Code | Count |", "|---|---|---|"]
    for (sev, code), c in Counter((i["severity"], i["code"]) for i in issues).most_common():
        L.append(f"| {sev} | {code} | {c} |")
    L += ["", "Errors and warnings in full:", ""]
    for i in issues:
        if i["severity"] in ("error", "warning") and i["code"] not in ("unclassified",):
            L.append(f"- **{i['severity']}** `{i['code']}` {i['questionId'] or i['paperId'] or ''}: {i['message']}")
    (out / "processing_report.md").write_text("\n".join(L))

    # ---------------- repeats ----------------
    exact_members = {m for g in rep["groups"]["exact"] for m in g["members"]}
    L = ["# Repeated-question analysis", "",
         "Counts are **distinct papers** in which a question family appears (multiple copies inside one paper are not double counted).", "",
         f"- Repeat families (exact + paraphrased) spanning ≥2 papers: **{t['repeatGroups']}**",
         f"- Exact-repeat groups spanning ≥2 papers: **{t['exactGroups']}**",
         f"- Families that recur across exam sessions (years): **{t['crossSessionGroups']}**",
         f"- Same-concept groups spanning ≥2 papers: **{t['conceptGroups']}**",
         f"- Borderline pairs still awaiting review: **{t['reviewPairsPending']}**", "",
         "## Most repeated question families", "", "| Group | Papers | Sessions | Type | Question (latest wording) | Appearances |", "|---|---|---|---|---|---|"]
    for g in [g for g in rep["groups"]["repeat"] if g["distinctPapers"] > 1][:150]:
        q = by_id[g["canonical"]]
        kind = "exact" if all(m in exact_members for m in g["members"]) else "exact+paraphrase"
        apps = ", ".join(f"{m}" for m in g["members"])
        L.append(f"| {g['id']} | {g['distinctPapers']} | {', '.join(g['sessions'])} | {kind} | {q['text'][:110].replace('|', '/').replace(chr(10), ' ')} | {apps} |")
    L += ["", "## Paper-to-paper overlap (share of paper A's questions with an exact copy in paper B)", "", "| A \\ B | " + " | ".join(pmap[p]["shortLabel"] for p in pmap) + " |", "|---" * (len(pmap) + 1) + "|"]
    for a in pmap:
        row = [pmap[a]["shortLabel"]]
        for b in pmap:
            row.append("–" if a == b else f"{overlap[(a, b)]['exact']}")
        L.append("| " + " | ".join(row) + " |")
    (out / "repeat_analysis.md").write_text("\n".join(L))

    # ---------------- per paper ----------------
    L = ["# Year-, date- and shift-wise paper reports", ""]
    for p in papers:
        s = stats["papers"][p["id"]]
        L += [f"## {p['label']}  (`{p['id']}`)", "", f"Source: {p['pdf']['name']} ({p['pdf']['pages']} pages) · answer key: {p['answerKeySource']}", "",
              f"- Questions extracted: **{s['questions']}** · key coverage {s['keyCoverage']}/{s['questions']}",
              f"- Repeated in ≥1 other paper: **{s['repeated']} ({s['repeatedPct']}%)** — exact {s['exactRepeats']}, paraphrased {s['paraphrasedRepeats']}, same-concept only {s['conceptRepeats']}",
              f"- Novelty: " + ", ".join(f"{k} {v}" for k, v in s["novelty"].items()),
              f"- Difficulty: " + ", ".join(f"{k} {v}" for k, v in s["byDifficulty"].items()),
              f"- Answer verification: " + ", ".join(f"{k} {v}" for k, v in s["answerStatus"].items()),
              "", "| Topic | Questions |", "|---|---|"]
        for k, v in list(s["byTopic"].items())[:20]:
            L.append(f"| {k} | {v} |")
        L.append("")
    (out / "paper_reports.md").write_text("\n".join(L))

    # ---------------- topics ----------------
    topic_rows = []
    agg = defaultdict(lambda: {"n": 0, "papers": Counter(), "rep": 0, "diff": Counter()})
    for q in questions:
        c = q["classification"]
        for key in ((c["subject"], c["topic"], ""), (c["subject"], c["topic"], c["subtopic"])):
            a = agg[key]
            a["n"] += 1
            a["papers"][q["paperId"]] += 1
            a["rep"] += 1 if q["repeat"]["distinctPapers"] > 1 else 0
            a["diff"][q["difficulty"]] += 1
    for (subj, top, sub), a in sorted(agg.items(), key=lambda kv: (kv[0][0], -agg[(kv[0][0], kv[0][1], '')]['n'], kv[0][1], kv[0][2])):
        row = {"subject": subj, "topic": top, "subtopic": sub or "(all)", "questions": a["n"],
               "pctOfSubject": round(100 * a["n"] / max(1, stats["bySubject"].get(subj, 1)), 1), "repeatedQuestions": a["rep"]}
        for p in papers:
            row[p["id"]] = a["papers"].get(p["id"], 0)
        row |= {f"difficulty_{k}": a["diff"].get(k, 0) for k in ("easy", "medium", "hard", "not rated")}
        topic_rows.append(row)
    _csv(out / "topic_stats.csv", topic_rows)
    L = ["# Topic weightage (historical, from the extracted papers only)", "",
         "Past frequency does not guarantee that a topic or question will appear in a future exam.", "",
         "| Subject | Topic | Questions | % of subject | Repeated |", "|---|---|---|---|---|"]
    for r in topic_rows:
        if r["subtopic"] == "(all)":
            L.append(f"| {r['subject']} | {r['topic']} | {r['questions']} | {r['pctOfSubject']}% | {r['repeatedQuestions']} |")
    cs_units = list(meta["taxonomy"]["Computer Science"].keys())
    seen_units = {r["topic"] for r in topic_rows if r["subject"] == "Computer Science" and r["questions"]}
    L += ["", "## Syllabus units with no observed questions", ""] + [f"- {u}" for u in cs_units if u not in seen_units] or ["- none"]
    (out / "topic_report.md").write_text("\n".join(L))

    # ---------------- answers ----------------
    L = ["# Answer verification report", "",
         "Status meanings: **verified** = source key and independent AI check agree (and no cross-paper conflict); "
         "**disputed** = AI check disagrees with the source key or the same question is keyed differently elsewhere; "
         "**source-key-unchecked** = key present, not independently checked; **unavailable** = no key.", "",
         "| Status | Questions |", "|---|---|"]
    for k, v in stats["answerStatus"].items():
        L.append(f"| {k} | {v} |")
    L += ["", "## Disputed answers (manual verification recommended)", "", "| Question | Source key | AI answer | AI confidence | Cross-paper | Notes |", "|---|---|---|---|---|---|"]
    for c in key_conflicts:
        L.append(f"| {c['id']} | {c['key']} | {c['ai'] or '-'} | {c['aiConfidence'] or '-'} | {c['crossPaper']} | {'; '.join(c['notes'])} {c['aiNote'][:200].replace('|', '/').replace(chr(10), ' ')} |")
    (out / "answer_verification.md").write_text("\n".join(L))
    _csv(out / "answer_conflicts.csv", [{**c, "notes": "; ".join(c["notes"])} for c in key_conflicts])

    # ---------------- review queue ----------------
    review = [p for p in rep["pairs"] if p["type"] == "review"]
    _csv(out / "match_review_queue.csv", [{"a": p["a"], "b": p["b"], **{f"score_{k}": v for k, v in p["scores"].items()}, "reason": p["reason"],
                                           "a_text": by_id[p["a"]]["text"][:200], "b_text": by_id[p["b"]]["text"][:200]} for p in review])

    # ---------------- flat CSV exports ----------------
    _csv(out / "questions.csv", [{
        "id": q["id"], "paper": q["paperId"], "date": pmap[q["paperId"]]["date"], "shift": pmap[q["paperId"]]["shift"], "qno": q["qno"],
        "subject": q["classification"]["subject"], "topic": q["classification"]["topic"], "subtopic": q["classification"]["subtopic"],
        "difficulty": q["difficulty"], "type": q["qtype"], "question": q["text"], **{f"option_{o['label']}": o["text"] for o in q["options"]},
        "key": q["answer"]["label"], "answer_status": q["answer"]["status"], "repeat_type": q["repeat"]["type"],
        "repeat_group": q["repeat"]["repeatGroup"] or "", "papers_in_family": q["repeat"]["distinctPapers"],
        "pdf": q["source"]["pdf"], "page": q["source"]["page"],
    } for q in questions])
    _csv(out / "repeat_groups.csv", [{
        "group": g["id"], "distinct_papers": g["distinctPapers"], "sessions": "; ".join(g["sessions"]), "first_seen": g["firstSeen"], "last_seen": g["lastSeen"],
        "members": "; ".join(g["members"]), "question": by_id[g["canonical"]]["text"],
    } for g in rep["groups"]["repeat"]])
    _csv(out / "paper_summary.csv", [{
        "paper": p["id"], "label": p["label"], "date": p["date"], "shift": p["shift"], "pdf": p["pdf"]["name"], **{k: v for k, v in stats["papers"][p["id"]].items() if not isinstance(v, dict)},
    } for p in papers])
    (out / "summary.json").write_text(json.dumps(stats["totals"], indent=1))
