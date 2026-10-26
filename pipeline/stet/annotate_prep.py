"""Prepare review batches for AI-assisted annotation.

Writes pipeline/annotations/input/batch_NN.json with one entry per *unique* question (one
representative per exact-repeat group) that has no annotation yet, and
pipeline/annotations/input/pairs_NN.json with borderline match pairs awaiting adjudication.

    python -m stet.annotate_prep --batch-size 100
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ANNOT = ROOT / "pipeline" / "annotations"


def main(argv=None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch-size", type=int, default=100)
    ap.add_argument("--pair-batch-size", type=int, default=270)
    a = ap.parse_args(argv)
    qs = json.loads((ROOT / "data" / "questions.json").read_text())
    groups = json.loads((ROOT / "data" / "repeat_groups.json").read_text())
    pairs = json.loads((ROOT / "data" / "matches.json").read_text())
    by_id = {q["id"]: q for q in qs}
    done = set()
    for f in (ANNOT / "ai").glob("annot_*.json"):
        done |= {x["id"] for x in json.loads(f.read_text())}
    member_group = {m: g for g in groups["exact"] for m in g["members"]}

    reps, seen = [], set()
    for q in qs:
        g = member_group.get(q["id"])
        rep_id = g["canonical"] if g else q["id"]
        if rep_id in seen:
            continue
        seen.add(rep_id)
        members = g["members"] if g else [rep_id]
        if any(m in done for m in members):
            continue
        r = by_id[rep_id]
        keys = sorted({by_id[m]["options"][by_id[m]["answer"]["index"]]["text"] for m in members if by_id[m]["answer"]["index"] is not None})
        reps.append({
            "id": rep_id,
            "sectionSubject": r["sectionSubject"],
            "text": r["text"],
            "textHi": r.get("textHi"),
            "options": [{"label": o["label"], "text": o["text"]} for o in r["options"]],
            "sourceKey": r["answer"]["label"],
            "sourceKeyText": r["options"][r["answer"]["index"]]["text"] if r["answer"]["index"] is not None else None,
            "keyTextsAcrossCopies": keys if len(keys) > 1 else None,
            "copies": members,
            "figure": r["figures"][0]["file"] if r["figures"] else None,
            "notes": r["extractionIssues"],
        })
    out = ANNOT / "input"
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.json"):
        f.unlink()
    for i in range(0, len(reps), a.batch_size):
        (out / f"batch_{i // a.batch_size + 1:02d}.json").write_text(json.dumps(reps[i : i + a.batch_size], ensure_ascii=False, indent=1))

    review = [p for p in pairs if p["type"] == "review"]
    slim = lambda q: {"id": q["id"], "text": q["text"], "options": [o["text"] for o in q["options"]],
                      "key": q["options"][q["answer"]["index"]]["text"] if q["answer"]["index"] is not None else None}
    items = [{"a": slim(by_id[p["a"]]), "b": slim(by_id[p["b"]]), "scores": p["scores"]} for p in review]
    for i in range(0, len(items), a.pair_batch_size):
        (out / f"pairs_{i // a.pair_batch_size + 1:02d}.json").write_text(json.dumps(items[i : i + a.pair_batch_size], ensure_ascii=False, indent=1))
    print(f"{len(reps)} questions in {(len(reps) + a.batch_size - 1) // a.batch_size} batches; {len(items)} review pairs")


if __name__ == "__main__":
    main()
