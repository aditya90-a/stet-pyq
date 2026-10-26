"""Per-question verification: every check is recorded with its evidence, then combined into one status.

Statuses
  verified    every check passed: text from the PDF text layer (or an OCR transcription confirmed against the
              page image), exactly one key marked (or an official DSSSB drop notice), metadata consistent,
              and an independent AI solve agrees with the key.
  corrected   as verified, but extracted text had to be corrected against the printed page; each correction
              is listed with its evidence.  The answer key is never changed.
  disputed    the key is in doubt: the AI solve disagrees or finds the question flawed, the same question is
              keyed differently in another paper, or the key read from the page image differs from the
              extracted key.  The source key is still shown, labelled as the source key.
  unverified  a check could not be completed (OCR not reviewed, no AI check, missing option text, ...).
"""
from __future__ import annotations

import re

from stet.normalize import norm

from .assemble import option_digits

LETTERS = "ABCD"


def _check(cid: str, label: str, result: str, detail: str = "") -> dict:
    return {"id": cid, "label": label, "result": result, "detail": detail}


def run(questions: list[dict], papers: dict[str, dict], qid_counts: dict[tuple[str, str], int]) -> None:
    for q in questions:
        paper = papers[q["paperId"]]
        checks: list[dict] = []
        issues = q["extractionIssues"]
        ev_pdf = {"type": "source-pdf", "file": q["source"]["pdf"], "page": q["source"]["page"], "pageEnd": q["source"]["pageEnd"]}

        # 1. options present
        empty = [o["label"] for o in q["options"] if not (o["text"] or "").strip() and not o["images"]]
        checks.append(_check("options", "Four options with text or image", "fail" if empty or len(q["options"]) != 4 else "pass",
                             f"empty: {', '.join(empty)}" if empty else "4 options found"))

        # 2. key marked
        k = q["keyRaw"]
        if q["dropped"]:
            checks.append(_check("key", "Answer key in source", "pass", "Officially ignored for all candidates (DSSSB note printed in the paper)"))
        elif len(k) == 1:
            checks.append(_check("key", "Answer key in source", "pass", f"option {LETTERS[k[0]]} marked correct (green, with tick)"))
        elif not k:
            checks.append(_check("key", "Answer key in source", "fail", "no option marked correct and no official note"))
        else:
            checks.append(_check("key", "Answer key in source", "fail", f"{len(k)} options marked correct"))

        # 3. key consistent between the English and Hindi blocks of the same Question Id
        bil = [i for i in issues if i.startswith("English block marks")]
        if q["source"].get("pageHi"):
            checks.append(_check("key-bilingual", "Same key in English and Hindi versions", "fail" if bil else "pass", bil[0] if bil else "both language blocks mark the same option"))

        # 4. key read from the page image by the reviewer
        tr = q.get("transcription")
        if tr and tr.get("keyInImage"):
            kim = tr["keyInImage"]
            expect = LETTERS[k[0]] if len(k) == 1 else ("none" if not k else "multiple")
            ok = kim == expect
            checks.append(_check("key-image", "Key seen on the page image matches the extracted key", "pass" if ok else "fail",
                                 f"image shows {kim}; extracted {expect}"))

        # 5. source Question ID
        sq = q.get("sourceQid")
        if not sq:
            checks.append(_check("source-id", "Source Question ID", "warn", "no Question ID printed"))
        elif qid_counts.get((q["paperId"], sq), 0) > 1:
            checks.append(_check("source-id", "Source Question ID", "fail", f"Question ID {sq} appears more than once in this paper"))
        else:
            checks.append(_check("source-id", "Source Question ID", "pass", sq))

        # 6. text source
        origin = q["textOrigin"]
        if origin == "pdf-text-layer":
            checks.append(_check("text", "Question text from the PDF", "pass", "text layer of the PDF"))
        elif origin == "ocr-confirmed":
            checks.append(_check("text", "Question text from the PDF", "pass", "OCR (Apple Vision) confirmed against the page image"))
        elif origin == "ocr-corrected":
            checks.append(_check("text", "Question text from the PDF", "pass", "OCR corrected against the page image (see corrections)"))
        elif origin == "transcribed":
            checks.append(_check("text", "Question text from the PDF", "pass", "transcribed from the page image"))
        else:
            checks.append(_check("text", "Question text from the PDF", "warn", f"{origin}: not yet checked against the page image"))

        # 7. Hindi repair
        if q.get("hindiFixes"):
            left = "unmapped-glyph-left" in q["hindiFixes"]
            checks.append(_check("hindi", "Hindi text decoded", "fail" if left else "pass",
                                 ("an undecoded glyph remains" if left else "decoded: " + ", ".join(f for f in q["hindiFixes"]))))

        # 8. numbers in English vs Hindi options
        if q["lang"] == "en" and any(o.get("textHi") for o in q["options"]):
            bad = [o["label"] for o in q["options"] if o.get("textHi") and option_digits(o["text"]) != option_digits(o["textHi"])]
            checks.append(_check("bilingual-numbers", "Numbers agree between English and Hindi options", "warn" if bad else "pass",
                                 f"differs in option(s) {', '.join(bad)}" if bad else "all options agree"))

        # 9. paper metadata
        fails = [c for c in paper.get("metaChecks", []) if c["result"] == "fail"]
        checks.append(_check("metadata", "Paper metadata (year, date, shift, post code)", "fail" if fails else "pass",
                             "; ".join(c["detail"] for c in fails) if fails else f"{paper['label']}: {len(paper.get('metaChecks', []))} checks passed"))

        # 10. independent AI answer check
        ai = q.get("aiCheck")
        if q["dropped"]:
            checks.append(_check("ai-answer", "Independent answer check", "na", "question was dropped by DSSSB"))
        elif not ai:
            checks.append(_check("ai-answer", "Independent answer check", "warn", "not reviewed yet"))
        else:
            a = ai.get("assessment")
            if a == "agree" and ai.get("derivedIndex") is not None and len(k) == 1 and ai["derivedIndex"] == k[0]:
                res = "pass" if ai.get("confidence") in ("high", "medium") else "warn"
                checks.append(_check("ai-answer", "Independent answer check", res, f"AI solve gives {ai['derivedLabel']} ({ai.get('confidence')} confidence)"))
            elif a == "ambiguous" or ai.get("derivedIndex") is None:
                checks.append(_check("ai-answer", "Independent answer check", "fail", "flagged as ambiguous/flawed: " + (ai.get("note") or "")))
            else:
                checks.append(_check("ai-answer", "Independent answer check", "fail",
                                     f"AI solve gives {ai.get('derivedLabel')}, source key {''.join(LETTERS[i] for i in k) or '-'}: " + (ai.get("note") or "")))

        # 11. cross-paper consistency
        cross = q["answer"]["crossPaper"]
        if cross != "none":
            checks.append(_check("cross-paper", "Same question keyed the same in other papers", "fail" if cross == "conflict" else "pass",
                                 "keyed differently in another paper" if cross == "conflict" else "consistent across papers"))

        # 12. duplicate inside the same paper
        if q["repeat"].get("withinPaper"):
            checks.append(_check("duplicate", "Not repeated inside the same paper", "warn", "also appears as " + ", ".join(q["repeat"]["withinPaper"])))

        # combine
        by = {c["id"]: c for c in checks}
        disputed = any(by.get(c, {}).get("result") == "fail" for c in ("ai-answer", "cross-paper", "key-image", "key-bilingual"))
        other_fail = any(c["result"] == "fail" for c in checks if c["id"] not in ("ai-answer", "cross-paper", "key-image", "key-bilingual"))
        critical_warn = any(c["result"] == "warn" for c in checks if c["id"] in ("text", "ai-answer"))
        if disputed:
            status = "disputed"
        elif other_fail or critical_warn:
            status = "unverified"
        elif q.get("corrections"):
            status = "corrected"
        else:
            status = "verified"
        evidence = [ev_pdf]
        if q.get("reviewImage"):
            evidence.append({"type": "page-image-review", "image": q["reviewImage"]})
        if q["officialNote"]:
            evidence.append({"type": "official-note", "text": q["officialNote"]})
        if paper.get("answerKey", {}).get("evidence"):
            evidence.append({"type": "answer-key-notice", "urls": paper["answerKey"]["evidence"]})
        q["verification"] = {
            "status": status,
            "checks": checks,
            "corrections": q.pop("corrections", []),
            "notes": q.pop("verificationNotes", []),
            "evidence": evidence,
        }


def correction(field: str, old: str, new: str, q: dict, reason: str) -> dict | None:
    if norm(old or "") == norm(new or "") and (old or "").strip() == (new or "").strip():
        return None
    if norm(old or "") == norm(new or ""):
        kind = "formatting"
    else:
        kind = "content"
    return {
        "field": field,
        "from": old,
        "to": new,
        "kind": kind,
        "reason": reason,
        "evidence": {"pdf": q["source"]["pdf"], "page": q["source"]["page"], "image": q.get("reviewImage")},
    }


def digits_only(s: str) -> str:
    return re.sub(r"\D", "", s or "")
