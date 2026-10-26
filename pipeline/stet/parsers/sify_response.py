"""Parser for 2024 BSEB candidate response sheets (btet.sifyreg.com print-outs, bilingual EN/HI).

Layout: "QID : N - <english>" + english continuation + hindi rows, "Options:",
"1) <en>" + hindi row(s) ..., "Correct Answer: k) <text>", "Candidate Answer: ...".
Languages are separated by font (Devanagari fonts: NirmalaUI / Kohinoor Devanagari).
"""
from __future__ import annotations

import re

from ..pdfutil import Row, Span, group_rows, has_devanagari
from .common import LABELS, ParsedPaper, RawOption, RawQuestion, join_lines

FMT = "bseb_sify_response_sheet"

RE_QID = re.compile(r"^QID\s*:\s*(\d+)\s*-\s*(.*)$", re.S)
RE_OPT = re.compile(r"^([1-4])\)\s*(.*)$", re.S)
RE_CORRECT = re.compile(r"^Correct Answer\s*:\s*([1-4])\)\s*(.*)$", re.S)

NOISE = [
    re.compile(r"https?://t\.me/\S+"),
    re.compile(r"https?://btet\.sifyreg\.com\S*"),
    re.compile(r"^\d{1,2}/\d{1,2}/\d{2,4},\s*\d{1,2}:\d{2}"),
    re.compile(r"^BIHAR SCHOOL EXAMINATION BOARD$"),
    re.compile(r"^\d+/\d+$"),
    re.compile(r"^Secondary Teacher Eligibility Test"),
    re.compile(r"^\d{1,2}\s*june.*shift\)?$", re.I),
]


def detect(first_pages_text: str) -> bool:
    return "QID :" in first_pages_text and "Correct Answer" in first_pages_text


def _strip_noise(spans: list[Span]) -> list[Span]:
    out = []
    for s in spans:
        t = s.text
        for rx in NOISE[:2]:
            t = rx.sub("", t)
        t2 = t.strip()
        if not t2 or any(rx.search(t2) for rx in NOISE[2:]):
            continue
        if t != s.text:
            s = Span(s.page, s.x0, s.y0, s.x1, s.y1, t, s.font, s.color)
        out.append(s)
    return out


def parse_meta(all_text: str) -> dict:
    meta: dict = {}
    if m := re.search(r"Secondary Teacher Eligibility Test,?\s*(\d{4})\s*\(([^)]+)\)", all_text):
        meta["examTitle"] = m.group(0).strip()
        meta["examEdition"] = m.group(2)
    if m := re.search(r"Paper\s*-\s*(\d)\s*\(\s*For class ([0-9-]+)\s*\)", all_text):
        meta["paper"] = f"Paper {'I' * int(m.group(1))}"
        meta["classes"] = m.group(2)
    if m := re.search(r"Subject & Subject Code\s*\n?\s*(.+?)\s*\((\d+)\)", all_text):
        meta["subjectName"], meta["subjectCode"] = m.group(1).strip(), m.group(2)
    if m := re.search(r"Date of Examination\s*\n?\s*(\d{2})-(\d{2})-(\d{4})", all_text):
        meta["date"] = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
        meta["dateSource"] = "Response sheet field (Date of Examination)"
    if m := re.search(r"Batch Start Time\s*\n?\s*([0-9:]+\s*[AP]M)", all_text):
        meta["timeStart"] = m.group(1)
    if m := re.search(r"Batch End Time\s*\n?\s*([0-9:]+\s*[AP]M)", all_text):
        meta["timeEnd"] = m.group(1)
    if m := re.search(r"(\d{1,2})\s*june[^()\n]*\((\d)(?:st|nd|rd|th)\s*shift\)", all_text, re.I):
        meta["uploaderShiftNote"] = m.group(0).strip()
        meta["shift"] = int(m.group(2))
        meta["shiftSource"] = "Annotation added to the PDF by its uploader (not an official field)"
    return meta


def parse(pages: dict[int, list[Span]], page_width: float, raw_text: str) -> ParsedPaper:
    meta = parse_meta(raw_text)
    rows: list[Row] = []
    for pno in sorted(pages):
        rows += group_rows(_strip_noise(pages[pno]))

    questions: list[RawQuestion] = []
    q: RawQuestion | None = None
    mode = None
    en: list[str] = []
    hi: list[str] = []
    opts: dict[int, tuple[list[str], list[str]]] = {}
    cur: int | None = None

    def is_hi(row: Row) -> bool:
        # English text never contains Devanagari; Hindi rows may mix in Latin acronyms (DNS, SQL ...)
        return has_devanagari(row.text) or row.deva_ratio() > 0.5

    def flush():
        if q is None:
            return
        if mode == "q":
            _finish_text(q, en, hi)
        for k in sorted(opts):
            e, h = opts[k]
            e_t, h_t = _dedupe_pair(join_lines(e), join_lines(h) if h else None)
            q.options.append(RawOption(LABELS[k - 1], e_t, h_t))
        questions.append(q)

    for row in rows:
        t = row.text.strip()
        if m := RE_QID.match(t):
            flush()
            q = RawQuestion(qno=len(questions) + 1, source_qid=m.group(1), page=row.page, page_end=row.page, y_start=row.y)
            mode, en, hi, opts, cur = "q", [m.group(2)], [], {}, None
            continue
        if q is None:
            continue
        q.page_end, q.y_end = row.page, row.y
        if t.startswith("Options:"):
            _finish_text(q, en, hi)
            mode = "opt"
            continue
        if m := RE_CORRECT.match(t):
            q.answer_index = int(m.group(1)) - 1
            q.answer_text_in_source = m.group(2).strip()
            mode = "ans"
            continue
        if t.startswith("Candidate Answer"):
            mode = "cand"  # the candidate's own response is deliberately not stored
            continue
        if mode == "q":
            (hi if is_hi(row) else en).append(row.text)
        elif mode == "opt":
            if (m := RE_OPT.match(t)) and not is_hi(row):
                cur = int(m.group(1))
                opts[cur] = ([m.group(2)], [])
            elif cur:
                opts[cur][1 if is_hi(row) else 0].append(row.text)
    flush()
    return ParsedPaper(FMT, meta, questions)


def _finish_text(q: RawQuestion, en: list[str], hi: list[str]) -> None:
    q.text, q.text_hi = _dedupe_pair(join_lines(en), join_lines(hi) if hi else None)


def _dedupe_pair(en: str, hi: str | None) -> tuple[str, str | None]:
    """Options like '100000\\n100000' repeat the English text in the Hindi slot using a Latin glyph run."""
    if hi is None:
        lines = en.split("\n")
        n = len(lines)
        if n % 2 == 0 and n >= 2 and lines[: n // 2] == lines[n // 2 :]:
            return "\n".join(lines[: n // 2]), "\n".join(lines[: n // 2])
    return en, hi
