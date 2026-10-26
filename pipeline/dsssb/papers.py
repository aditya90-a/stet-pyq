"""Paper metadata with provenance.

Each field records where it comes from:
  printed   - printed inside the paper itself
  filename  - the source file name
  notice    - an official DSSSB notice (URL in `evidence`)
  inferred  - derived (e.g. from a file timestamp); never shown as fact
and a status: verified (two independent sources agree, or printed + notice), single-source, inferred,
not-available, conflict.  `checks` compares what the paper prints with this registry so a wrong mapping
is reported instead of silently used.
"""
from __future__ import annotations

import re

NOTICE_91_20 = "https://dsssb.delhi.gov.in/sites/default/files/DSSSB/universal-tab/notice_91-20.pdf"
KEYS_91_20 = "https://dsssb.delhi.gov.in/sites/default/files/DSSSB/universal-tab/exam_notice_nov0008_1.pdf"
SCHED_39_22 = "https://dsssb.delhi.gov.in/sites/default/files/DSSSB/circulars-orders/scan_0075_0.pdf"
KEYS_39_22 = "https://dsssb.delhi.gov.in/sites/default/files/DSSSB/universal-tab/notice_10009.pdf"
ADVT_70_23 = "https://dsssb.delhi.gov.in/sites/default/files/DSSSB/circulars-orders/scan0005_6.pdf"
KEYS_70_23 = "https://dsssb.delhi.gov.in/sites/default/files/DSSSB/universal-tab/scan0089_2.pdf"
SYL_70_23 = "https://dsssb.delhi.gov.in/sites/default/files/DSSSB/universal-tab/tgt_computer_science_in_ndmc.pdf"

_SET_91_20 = {
    "postCode": "91/20",
    "advt": "04/20",
    "department": "Directorate of Education (DoE), GNCTD",
    "departmentShort": "DoE",
    "currentSyllabusMatch": "DoE TGT Computer Science (same department as the current post code 41/26)",
    "examDates": ["2021-08-01", "2021-08-07"],
    "answerKey": {
        "label": "Key marked in the DSSSB/EdCIL master question paper (green option with tick)",
        "detail": "The file carries DSSSB's own post-objection notes ('discrepancy is found in question/answer. So, this question is ignored for all candidates'), which indicates the final-key version. Final keys for 91/20 were notified on 06/10/2021.",
        "official": True,
        "evidence": [KEYS_91_20],
    },
}

PAPERS: dict[str, dict] = {
    # md5 -> registry entry
    **{
        md5: {
            "id": f"2021-set{n}",
            "set": n,
            "year": 2021,
            **_SET_91_20,
            "label": f"2021 · Set {n} (91/20)",
            "shortLabel": f"2021 S{n}",
            "labelHi": f"2021 · सेट {n} (91/20)",
            "date": None,
            "dateStatus": "not-available",
            "dateNote": "The exam date is not printed in this paper. DSSSB notice No. 46 says the 91/20 exam was held on 01/08/2021 and 07/08/2021.",
            "inferredDate": inferred,
            "inferredDateNote": f"Inferred only from the paper's 'Creation Date' ({created}); not used as fact.",
            "shift": None,
            "shiftLabel": f"Set {n} (shift not printed)",
            "shiftStatus": "not-available",
            "time": None,
            "evidence": [NOTICE_91_20],
            "expectPaperName": f"TGT Computer Science{n}",
        }
        for n, (md5, created, inferred) in enumerate(
            [
                ("957720c9", "2021-08-01 16:50:59", "2021-08-01"),
                ("0e80fa3c", "2021-08-01 20:12:11", "2021-08-01"),
                ("45fbe96b", "2021-08-07 11:46:25", "2021-08-07"),
                ("1f87e175", "2021-08-07 16:35:52", "2021-08-07"),
                ("fab4427c", "2021-08-08 11:10:26", "2021-08-07"),
            ],
            start=1,
        )
    },
    "d0975d35": {
        "id": "2023-06-24-s2",
        "year": 2023,
        "postCode": "39/22",
        "advt": "08/22",
        "department": "Directorate of Education (DoE), GNCTD",
        "departmentShort": "DoE",
        "currentSyllabusMatch": "DoE TGT Computer Science (same department as the current post code 41/26)",
        "label": "24 Jun 2023 · Shift 2 (39/22)",
        "labelHi": "24 जून 2023 · पाली 2 (39/22)",
        "shortLabel": "2023 S2",
        "date": "2023-06-24",
        "dateStatus": "verified",
        "dateNote": "Printed in the paper name ('24th Jun 2023 Shift 2') and in the file name; DSSSB's schedule lists 39/22 on 24.06.2023 Shift II (12:30-02:30 PM).",
        "shift": 2,
        "shiftLabel": "Shift 2",
        "shiftStatus": "verified",
        "time": "12:30 PM - 2:30 PM",
        "timeSource": "notice",
        "examDates": ["2023-06-24", "2023-06-25"],
        "answerKey": {
            "label": "Key marked in the DSSSB/EdCIL master question paper (green option with tick)",
            "detail": "The paper header says 'Actual Answer Key : Yes'. Final keys for 39/22 were notified on 10/08/2023.",
            "official": True,
            "evidence": [KEYS_39_22],
        },
        "evidence": [SCHED_39_22, KEYS_39_22],
        "expectPaperName": "TGTComputerScience 24th Jun 2023 Shift 2",
        "expectDateInName": "24 Jun 2023",
        "expectShiftInName": 2,
    },
    "35a2f2db": {
        "id": "2024-02-07-s2",
        "year": 2024,
        "postCode": "70/23",
        "advt": "02/23",
        "department": "New Delhi Municipal Council (NDMC)",
        "departmentShort": "NDMC",
        "currentSyllabusMatch": "NDMC post - its official syllabus is a different, CBSE-style list (Python, Society/Law/Ethics...). Useful practice, but not the DoE 41/26 syllabus.",
        "label": "07 Feb 2024 · Shift 2 (70/23, NDMC)",
        "labelHi": "07 फ़रवरी 2024 · पाली 2 (70/23, NDMC)",
        "shortLabel": "2024 S2",
        "date": "2024-02-07",
        "dateStatus": "verified",
        "dateNote": "Printed in the paper (Test Date 07/02/2024) and in the file name; DSSSB's 70/23 notices give the exam on 07.02.2024 Shift II.",
        "shift": 2,
        "shiftLabel": "Shift 2",
        "shiftStatus": "verified",
        "time": "12:30 PM - 2:30 PM",
        "timeSource": "printed",
        "examDates": ["2024-02-07"],
        "answerKey": {
            "label": "Key as printed in the republished copy (green option with tick)",
            "detail": "This copy was republished by Adda247 from the Digialm master paper. Final keys for 70/23 were notified on 16/04/2024; the republished copy cannot itself prove it is the final version.",
            "official": False,
            "evidence": [KEYS_70_23],
        },
        "evidence": [ADVT_70_23, KEYS_70_23, SYL_70_23],
        "expectDate": "2024-02-07",
        "expectTime": ("12:30 PM", "2:30 PM"),
        "republishedBy": "Adda247",
    },
}


def lookup(md5: str) -> dict | None:
    return PAPERS.get(md5[:8])


def check(entry: dict, meta: dict, filename: str) -> list[dict]:
    """Compare the registry with what the paper and its file name say."""
    out: list[dict] = []

    def add(field: str, ok: bool, detail: str) -> None:
        out.append({"field": field, "result": "pass" if ok else "fail", "detail": detail})

    if "expectPaperName" in entry:
        got = meta.get("paperName")
        add("paperName", got == entry["expectPaperName"], f"printed: {got!r}; expected {entry['expectPaperName']!r}")
    if "expectDateInName" in entry:
        add("date", meta.get("paperNameDate") == entry["expectDateInName"], f"paper name gives {meta.get('paperNameDate')!r}")
        add("shift", meta.get("paperNameShift") == entry["expectShiftInName"], f"paper name gives shift {meta.get('paperNameShift')!r}")
    if "expectDate" in entry:
        add("date", meta.get("date") == entry["expectDate"], f"printed Test Date {meta.get('date')!r}")
    if "expectTime" in entry:
        got = (meta.get("timeStart"), meta.get("timeEnd"))
        add("time", got == entry["expectTime"], f"printed Test Time {got}")
    if entry.get("date"):
        y, m, d = entry["date"].split("-")
        months = "jan feb mar apr may jun jul aug sep oct nov dec".split()
        fn = filename.lower().replace("-", " ").replace("_", " ")
        in_name = (str(int(d)) in fn or d in fn) and months[int(m) - 1] in fn and y in fn
        add("filename", in_name, f"file name {filename!r} {'contains' if in_name else 'does not contain'} the date")
    if entry["year"] == 2021 and meta.get("creationDate"):
        add("year", meta["creationDate"].startswith("2021-08"), f"paper Creation Date {meta['creationDate']}")
    if meta.get("totalMarks") is not None:
        add("totalMarks", meta["totalMarks"] == 200, f"printed Total Marks {meta['totalMarks']}")
    if meta.get("durationMin") is not None:
        add("duration", meta["durationMin"] == 120, f"printed Duration {meta['durationMin']} min")
    return out


SECTION_NAMES = {
    # raw section name in the paper -> (canonical section, part)
    "General Awareness": ("General Awareness", "A"),
    "General Ability": ("General Intelligence & Reasoning", "A"),
    "General intelligence and Reasoning Ability": ("General Intelligence & Reasoning", "A"),
    "Arithmetic Ability": ("Arithmetical & Numerical Ability", "A"),
    "Arithmetical and Numerical Ability": ("Arithmetical & Numerical Ability", "A"),
    "General Hindi": ("Hindi Language", "A"),
    "Test of Hindi Language and Comprehension": ("Hindi Language", "A"),
    "General English": ("English Language", "A"),
    "Test of English Language and Comprehension": ("English Language", "A"),
    "Teaching Methodology": ("Teaching Methodology", "B"),
}


def canonical_section(raw: str | None) -> tuple[str, str]:
    if raw in SECTION_NAMES:
        return SECTION_NAMES[raw]
    if raw and re.match(r"Discipline\d", raw):
        return ("Computer Science", "B")
    return (raw or "Unknown", "?")
