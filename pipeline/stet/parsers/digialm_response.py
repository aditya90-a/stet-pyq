"""Parser for 2025 STET response sheets (digialm-style layout, republished by Adda247).

Each question: "Q.N" label (digits may wrap onto a second line), question text, "Ans",
options "A. ..".."D. .." where the keyed correct option is rendered in green and the others
in red, then a metadata box (Question Type, Question ID, Option IDs, Status, Chosen Option).
"""
from __future__ import annotations

import re

from ..pdfutil import PageImage, Row, Span, group_rows
from .common import LABELS, ParsedPaper, RawOption, RawQuestion, join_lines

FMT = "digialm_response_sheet"

META_LABEL = re.compile(r"^(Question Type|Question ID|Option \d ID|Status|Chosen Option)\s*:")
RE_QLABEL = re.compile(r"^Q\.(\d+)$")
RE_OPT = re.compile(r"^([A-D])\.\s*(.*)$", re.S)
LABEL_X = 63.5  # Q-number column
META_X = 370.0


def detect(first_pages_text: str) -> bool:
    return "Chosen Option" in first_pages_text and "Question ID" in first_pages_text


def is_green(s: Span) -> bool:
    r, g, b = s.rgb
    return g > 150 and g > r + 60 and g > b + 40


def is_red(s: Span) -> bool:
    r, g, b = s.rgb
    return r > 180 and r > g + 80


def parse_meta(all_text: str) -> dict:
    meta: dict = {}
    if m := re.search(r"Exam Name\s*\n?\s*(STET Exam \d{4})", all_text):
        meta["examTitle"] = m.group(1)
    if m := re.search(r"\nPaper\s*\n?\s*(Paper [IV]+)", all_text):
        meta["paper"] = m.group(1)
    if m := re.search(r"Test Date\s*\n?\s*(\d{2})/(\d{2})/(\d{4})", all_text):
        meta["date"] = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
        meta["dateSource"] = "Response sheet field (Test Date)"
    if m := re.search(r"Test Time\s*\n?\s*([0-9:]+\s*[AP]M)\s*-\s*([0-9:]+\s*[AP]M)", all_text):
        meta["timeStart"], meta["timeEnd"] = m.group(1), m.group(2)
    if m := re.search(r"(\d{2} \w{3}, \d{4})\s*Shift\s*(\d)", all_text):
        meta["coverLabel"] = m.group(0)
        meta["shift"] = int(m.group(2))
        meta["shiftSource"] = "Cover page added by the republisher (Adda247)"
    if m := re.search(r"Section\s*:\s*Part I\s+(.+?)\((\d+)\)", all_text):
        meta["subjectName"], meta["subjectCode"] = m.group(1).strip(), m.group(2)
    return meta


def parse(pages: dict[int, list[Span]], page_width: float, raw_text: str, images: list[PageImage]) -> ParsedPaper:
    meta = parse_meta(raw_text)
    questions: list[RawQuestion] = []
    q: RawQuestion | None = None
    section: str | None = None
    mode = None
    label_digits = ""
    text_rows: list[str] = []
    opts: dict[str, dict] = {}
    cur: str | None = None
    seen_qids: set[str] = set()

    def flush():
        if q is None:
            return
        if mode == "q":
            q.text = join_lines(text_rows)
        for lab in LABELS:
            if lab in opts:
                q.options.append(RawOption(lab, join_lines(opts[lab]["lines"])))
        greens = [i for i, lab in enumerate(LABELS) if lab in opts and opts[lab]["green"]]
        if len(greens) == 1:
            q.answer_index = greens[0]
        elif len(greens) == 0:
            q.issues.append("no option marked correct (green) in source")
        else:
            q.issues.append(f"{len(greens)} options marked correct (green) in source")
        questions.append(q)

    for pno in sorted(pages):
        rows = group_rows(pages[pno])
        for row in rows:
            spans = row.spans
            # section header (grey text)
            joined = row.text.strip()
            if joined.startswith("Section"):
                if m := re.match(r"Section\s*:\s*(.+)$", joined):
                    section = m.group(1).strip()
                continue
            # split metadata spans away from content spans
            meta_spans: list[Span] = []
            content: list[Span] = []
            in_meta = False
            for s in spans:
                if s.x0 >= META_X and META_LABEL.match(s.text.strip()):
                    in_meta = True
                (meta_spans if in_meta else content).append(s)
            if meta_spans and q is not None:
                mt = " ".join(s.text.strip() for s in meta_spans)
                if m := re.match(r"Question ID\s*:\s*(\d+)", mt):
                    q.source_qid = m.group(1)
                    if q.source_qid in seen_qids:
                        q.issues.append(f"duplicate Question ID {q.source_qid} within paper")
                    seen_qids.add(q.source_qid)
                elif mt.startswith("Question Type") and "MCQ" not in mt:
                    q.issues.append(f"non-MCQ question type: {mt}")
                if mode == "q":
                    q.text = join_lines(text_rows)
                mode = "meta"
            if not content:
                continue
            first = content[0]
            if (m := RE_QLABEL.match(first.text.strip())) and first.x0 < LABEL_X:
                flush()
                q = RawQuestion(qno=0, section=section, page=pno, page_end=pno, y_start=row.y)
                label_digits = m.group(1)
                mode, text_rows, opts, cur = "q", [], {}, None
                content = content[1:]
                if not content:
                    q.qno = int(label_digits)
                    continue
            if q is None:
                continue
            q.page_end, q.y_end = pno, row.y
            if mode == "q":
                if content and content[0].x0 < LABEL_X and content[0].text.strip() == "Ans":
                    q.qno = int(label_digits)
                    q.text = join_lines(text_rows)
                    mode = "opt"
                    content = content[1:]
                    if not content:
                        continue
                else:
                    if content and content[0].x0 < LABEL_X and content[0].text.strip().isdigit():
                        label_digits += content[0].text.strip()
                        content = content[1:]
                    if content:
                        text_rows.append(_join(content))
                    continue
            if mode == "opt":
                t = _join(content).strip()
                if m := RE_OPT.match(t):
                    cur = m.group(1)
                    opts[cur] = {"lines": [m.group(2)], "green": any(is_green(s) for s in content)}
                elif cur:
                    opts[cur]["lines"].append(t)
                    opts[cur]["green"] |= any(is_green(s) for s in content)
    flush()
    _attach_figures(questions, images)
    return ParsedPaper(FMT, meta, questions)


def _join(spans: list[Span]) -> str:
    from ..pdfutil import join_spans

    return join_spans(spans)


def _attach_figures(questions: list[RawQuestion], images: list[PageImage]) -> None:
    """Images other than the per-page decorations (logos, watermark, tick/cross icons) are question figures."""
    from collections import Counter

    xref_count = Counter(i.xref for i in images)
    for img in images:
        x0, y0, x1, y1 = img.rect
        if xref_count[img.xref] > 3 or (x1 - x0) < 25 or (y1 - y0) < 15:
            continue
        for q in questions:
            if q.page <= img.page <= q.page_end and (img.page > q.page or y0 >= q.y_start - 5) and (img.page < q.page_end or y0 <= q.y_end + 40):
                q.figures.append({"page": img.page, "rect": [round(v, 1) for v in img.rect], "xref": img.xref})
                break
