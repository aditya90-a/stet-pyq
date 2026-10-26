"""Parser for the 2023 BSEB "QUESTION PAPER" layout (Word export).

Layout per question:  "Question N" | "Question Id : X" (right column)
question text rows, "Answer :", options "(A) ..." with option ids in the right column,
"Right Answer :" + answer text, "Right Option Id : X" (right column).
"""
from __future__ import annotations

import re

from ..pdfutil import Row, Span, group_rows
from .common import LABELS, ParsedPaper, RawOption, RawQuestion, join_lines

FMT = "bseb_question_paper"

RE_QNO = re.compile(r"^Question\s+(\d+)\s*$")
RE_QID = re.compile(r"Question Id\s*:\s*(\d+)")
RE_RIGHT_ID = re.compile(r"Right Option Id\s*:\s*(\d+)")
RE_OPT = re.compile(r"^\(\s*([A-D])\s*\)\s*(.*)$", re.S)


def detect(first_pages_text: str) -> bool:
    return "Right Option Id" in first_pages_text and "QUESTION PAPER" in first_pages_text


def parse_meta(text: str) -> dict:
    meta: dict = {}
    if m := re.search(r"QUESTION PAPER\s+(.+?)\[\s*SHIFT\s*-\s*(\d+)\s*\]", text):
        meta["headerTitle"] = m.group(0).strip()
        meta["shift"] = int(m.group(2))
        meta["shiftSource"] = "Printed in paper header ([SHIFT - n])"
    if m := re.search(r"Exam Date\s*:\s*(\d{2})/(\d{2})/(\d{4})", text):
        meta["date"] = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
        meta["dateSource"] = "Printed in paper header (Exam Date)"
    if m := re.search(r"Time\s*:\s*([0-9:]+\s*[AP]M)\s*-\s*([0-9:]+\s*[AP]M)", text):
        meta["timeStart"], meta["timeEnd"] = m.group(1), m.group(2)
    if m := re.search(r"Subject Name\s*:\s*(.+)", text):
        meta["subjectName"] = m.group(1).strip()
    if m := re.search(r"Subject Code\s*:\s*(\d+)", text):
        meta["subjectCode"] = m.group(1)
    return meta


def parse(pages: dict[int, list[Span]], page_width: float) -> ParsedPaper:
    right_x = page_width * 0.66
    left_rows: list[Row] = []
    right_spans: list[Span] = []
    for pno in sorted(pages):
        spans = pages[pno]
        right_spans += [s for s in spans if s.x0 >= right_x]
        left_rows += group_rows([s for s in spans if s.x0 < right_x])

    header_text = "\n".join(r.text for r in left_rows[:12]) + "\n" + "\n".join(s.text for s in right_spans[:6])
    meta = parse_meta(header_text)

    questions: list[RawQuestion] = []
    q: RawQuestion | None = None
    mode = None
    buf: list[str] = []
    opt_lines: dict[str, list[str]] = {}
    ans_lines: list[str] = []

    def flush():
        nonlocal q
        if q is None:
            return
        for lab in LABELS:
            if lab in opt_lines:
                q.options.append(RawOption(lab, join_lines(opt_lines[lab])))
        q.answer_text_in_source = join_lines(ans_lines) or None
        questions.append(q)

    for row in left_rows:
        t = row.text.strip()
        if m := RE_QNO.match(t):
            flush()
            q = RawQuestion(qno=int(m.group(1)), page=row.page, page_end=row.page, y_start=row.y)
            mode, buf, opt_lines, ans_lines = "q", [], {}, []
            continue
        if q is None:
            continue
        q.page_end, q.y_end = row.page, row.y
        if t.startswith("Answer :") or t == "Answer:":
            q.text = join_lines(buf)
            mode = "opt"
            cur = None
            continue
        if t.startswith("Right Answer"):
            mode = "ans"
            continue
        if mode == "q":
            buf.append(row.text)
        elif mode == "opt":
            if m := RE_OPT.match(t):
                cur = m.group(1)
                opt_lines[cur] = [m.group(2)]
            elif cur:
                opt_lines[cur].append(row.text)
            else:
                q.issues.append(f"unattached option text: {t[:60]}")
        elif mode == "ans":
            ans_lines.append(row.text)
    flush()

    # right column: question ids, option ids and the keyed option id, assigned by vertical position
    _attach_right_column(questions, right_spans)
    return ParsedPaper(FMT, meta, questions)


def _attach_right_column(questions: list[RawQuestion], right_spans: list[Span]) -> None:
    def owner(s: Span) -> RawQuestion | None:
        best = None
        for q in questions:
            if (q.page, q.y_start - 4) <= (s.page, s.y0):
                best = q
            else:
                break
        return best

    opt_ids: dict[int, list[str]] = {}
    for s in sorted(right_spans, key=lambda s: (s.page, s.y0)):
        q = owner(s)
        if q is None:
            continue
        t = s.text.strip()
        if m := RE_QID.search(t):
            q.source_qid = m.group(1)
        elif m := RE_RIGHT_ID.search(t):
            rid = m.group(1)
            ids = opt_ids.get(id(q), [])
            if rid in ids:
                q.answer_index = ids.index(rid)
            else:
                q.issues.append(f"right option id {rid} not among option ids {ids}")
        elif re.fullmatch(r"\d{3,}", t):
            opt_ids.setdefault(id(q), []).append(t)
