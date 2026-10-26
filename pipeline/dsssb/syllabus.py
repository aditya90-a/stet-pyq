"""Official syllabus (OCR of the scanned DSSSB annex, checked against the page images) and exam information
(from official DSSSB documents; see official/research.json for every source)."""
from __future__ import annotations

import json
import re
from pathlib import Path

from rapidfuzz import fuzz

from .taxonomy import SYLLABUS_41_26_CS, SYLLABUS_41_26_PEDAGOGY, TAXONOMY

OFFICIAL = Path(__file__).with_name("official")
SYLLABUS_URL = "https://dsssb.delhi.gov.in/sites/default/files/DSSSB/universal-tab/pc-41-26_tgt_computer_science_in_doe.pdf"
SECTION_A_URL = "https://dsssb.delhi.gov.in/sites/default/files/DSSSB/universal-tab/syllabus_i-t-t_one_tier_technical_i_teaching_200_marks.pdf"


def _ocr_items(text: str) -> list[str]:
    """Numbered items from OCR text, re-joining wrapped continuation lines."""
    items: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if re.match(r"^\d+[.,]\s", line):
            items.append(re.sub(r"^\d+[.,]\s*", "", line))
        elif items and line and not line.lower().startswith(("syllabus", "topics of")):
            items.append(items.pop() + " " + line)
    return items


def syllabus_record(records: list) -> dict:
    """Pair every verified syllabus line with what OCR read, so each difference is visible as evidence."""
    rec = next((r for _, r in records if r.get("format") == "scanned-document"), None)
    ocr_pages = rec.get("ocrPages", []) if rec else []
    ocr_cs = _ocr_items(ocr_pages[0]["text"]) if len(ocr_pages) > 0 and ocr_pages[0].get("text") else []
    ocr_ped = _ocr_items(ocr_pages[1]["text"]) if len(ocr_pages) > 1 and ocr_pages[1].get("text") else []

    def pair(verified: list[str], ocr: list[str], page: int) -> list[dict]:
        out = []
        for i, v in enumerate(verified):
            o = ocr[i] if i < len(ocr) else None
            sim = round(fuzz.ratio(v, o), 1) if o else 0.0
            out.append({"n": i + 1, "text": v, "ocr": o, "similarity": sim, "page": page,
                        "status": "ocr-confirmed" if o and sim >= 97 else "corrected-from-page-image"})
        return out

    units = {t: [] for t in ()}
    unit_topics: dict[int, list[str]] = {}
    for topic, v in TAXONOMY["Computer Science"]["topics"].items():
        for u in v.get("units", []):
            unit_topics.setdefault(u, []).append(topic)
    cs = pair(SYLLABUS_41_26_CS, ocr_cs, 1)
    for u in cs:
        u["topics"] = unit_topics.get(u["n"], [])
    ped_topics: dict[str, list[str]] = {}
    for topic, v in TAXONOMY["Teaching Methodology"]["topics"].items():
        for u in v.get("units", []):
            ped_topics.setdefault(u, []).append(topic)
    ped = pair(SYLLABUS_41_26_PEDAGOGY, ocr_ped, 2)
    for u in ped:
        u["topics"] = ped_topics.get(f"P{u['n']}", [])
    del units
    return {
        "title": "SYLLABUS: TGT Computer Science in DOE (Post Code 41/26)",
        "file": rec["file"]["name"] if rec else None,
        "url": SYLLABUS_URL,
        "official": True,
        "ocrEngine": "apple-vision-accurate",
        "ocrStatus": rec.get("status") if rec else "missing",
        "transcriptionNote": "OCR of the scanned DSSSB file, then every line checked against the page image. Lines that OCR misread are marked 'corrected-from-page-image' with the OCR reading kept as evidence.",
        "csUnits": cs,
        "pedagogyUnits": ped,
        "sectionA": {
            "title": "SYLLABUS: I-T-T One Tier (Technical / Teaching) 200 Marks — Section A",
            "url": SECTION_A_URL,
            "official": True,
            "parts": [
                {"subject": "General Awareness", "marks": 20, "text": "Current events, everyday observation, History, Polity, Constitution, Sports, Art & Culture, Geography, Economics, Everyday Science, Scientific Research, National/International Organizations/Institutions."},
                {"subject": "General Intelligence & Reasoning", "marks": 20, "text": "Analogy, Classification, Series, Coding-Decoding, Blood Relations, Direction Sense, Logical Venn Diagrams, Alphabet Test, Sitting Arrangements, Mathematical Operations, Arithmetical Reasoning, Missing character, Number/Ranking/Time Sequence, Eligibility Test, Syllogism, Statement-Arguments/Assumptions/Courses of action/Conclusions, Deriving Conclusion, Assertion-Reason, Punch Lines, Situation Reaction, Cause and Effect, Analytical Reasoning."},
                {"subject": "Arithmetical & Numerical Ability", "marks": 20, "text": "Number Systems incl. Simplification, Decimals, Data Interpretation, Fractions, LCM, HCF, Ratio & Proportion, Percentage, Average, Profit & Loss, Discount, Simple & Compound Interest, Mensuration, Time & Work, Time & Distance, Tables & Graphs, Pie/Line/Bar charts, Venn Diagrams."},
                {"subject": "English Language", "marks": 20, "text": "Vocabulary, grammar, sentence structure, synonyms, antonyms and their correct usage; comprehension."},
                {"subject": "Hindi Language", "marks": 20, "text": "शब्दावली, व्याकरण, वाक्य संरचना, पर्यायवाची, विलोम और उनका सही प्रयोग; बोधगम्यता (vocabulary, grammar, sentence structure, synonyms, antonyms, correct usage)."},
            ],
            "note": "Section A topics as summarised from the official I-T-T syllabus PDF; Section B is '100 MCQs pertaining to Graduation qualification and Teaching Methodology required for the post'.",
        },
    }


def exam_info() -> dict:
    r = json.loads((OFFICIAL / "research.json").read_text())
    facts = {f["key"]: f for f in r["facts"]}
    current_keys = ["advt_41_26", "vacancies_41_26", "pay_41_26", "age_41_26", "qualification_41_26", "application_dates_41_26",
                    "fee_41_26", "exam_scheme_41_26", "qualifying_marks_41_26", "exam_dates_41_26"]
    history_keys = ["tgt_scheme_2017_notice", "generic_ITT_scheme_2021_2023", "historical_192_14", "historical_91_20"]
    return {
        "researchedOn": r.get("generated") or "2026-10-26",
        "summary": r.get("summary"),
        "current": [facts[k] for k in current_keys if k in facts],
        "pattern": r["examPattern"],
        "historyFacts": [facts[k] for k in history_keys if k in facts],
        "postCodes": r["postCodes"],
        "thirdParty": r.get("thirdPartyNotes", []),
        "openQuestions": r.get("openQuestions", []),
    }
