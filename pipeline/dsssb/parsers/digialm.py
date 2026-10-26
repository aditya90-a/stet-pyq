"""Parser for Digialm "master question paper with answer key" print-outs republished by Adda247, used by the
07 Feb 2024 Shift 2 TGT Computer Science paper (post code 70/23, NDMC).

Layout per question: "Q.N" in the left column (question text on the same or following rows), optional figure
images, "Ans", four options "k. text" printed green (key) or red with a tick / cross icon, and a box on the
right with "Question ID" and the option IDs.  Numbering restarts in every section ("Section : <name>").
Comprehension passages start with "Comprehension:" and their questions carry "SubQuestion No : N".
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from stet import hindi
from stet.pdfutil import PageImage, Row, has_devanagari, join_spans

from ..layout import rows_with_scripts
from ..pdf import SSpan, row_top

FMT = "digialm_master_paper"

RE_QLABEL = re.compile(r"^Q\.(\d+)$")
RE_QLABEL_INLINE = re.compile(r"^Q\.(\d+)\s+(.*)$", re.S)
RE_OPT = re.compile(r"^([1-4])\.\s*(.*)$", re.S)
RE_SECTION = re.compile(r"^Section\s*:\s*(.+)$")
META_X = 380.0
LABEL_X = 64.0
HEADER_ROWS = re.compile(r"^(Participant ID|Participant Name|Test Center Name|Test Date|Test Time|Subject)\b")
TICK_PX = (16, 16)
CROSS_PX = (31, 21)
# Type3 text in this file sometimes splits a capital T from the rest of the word ("T he", "T his")
_KERN_T = re.compile(r"\bT (?=[a-z])")
# Hindi in the Type3 font: the danda is a "|" printed before the final matra ("कर|ें"), and a vowel sign with
# its nasal mark is sometimes doubled ("गद्यांांश")
_DANDA_BEFORE_SIGN = re.compile(r"\|([ा-्ऀ-ः]+)")
_DUP_SIGN_PAIR = re.compile(r"([ा-ौ][ऀ-ं])\1")


def _is_deva(ch: str) -> bool:
    return "ऀ" <= ch <= "ॿ"


def is_green(s: SSpan) -> bool:
    r, g, b = s.rgb
    return g >= 150 and g > r + 60 and g > b + 40


def is_red(s: SSpan) -> bool:
    r, g, b = s.rgb
    return r >= 180 and r > g + 80


def parse_meta(all_text: str) -> dict:
    meta: dict = {}
    if m := re.search(r"Test Date\s*\n?\s*(\d{2})/(\d{2})/(\d{4})", all_text):
        meta["date"] = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    if m := re.search(r"Test Time\s*\n?\s*([0-9:]+\s*[AP]M)\s*-\s*([0-9:]+\s*[AP]M)", all_text):
        meta["timeStart"], meta["timeEnd"] = m.group(1), m.group(2)
    if m := re.search(r"\nSubject\s*\n\s*(.+)", all_text):
        meta["subjectName"] = m.group(1).strip()
    return meta


@dataclass
class Q:
    section: str | None
    sec_qno: int
    page: int
    passage: str | None
    page_end: int = 0
    y: float = 0.0
    y_end: float = 0.0
    text_rows: list[str] = field(default_factory=list)
    images: list[PageImage] = field(default_factory=list)
    options: dict[int, dict] = field(default_factory=dict)
    qid: str | None = None
    sub_qno: int | None = None


def _clean(t: str) -> tuple[str, list[str]]:
    fixes: list[str] = []
    new = _KERN_T.sub("T", t)
    if new != t:
        fixes.append("type3-kerning-space-removed")
    if has_devanagari(new):
        fixed = _DUP_SIGN_PAIR.sub(r"\1", _DANDA_BEFORE_SIGN.sub(r"\1।", new))
        fixed = re.sub(r"(?<=[ऀ-ॿ])\|", "।", fixed)
        if fixed != new:
            fixes.append("type3-danda-and-doubled-sign-repaired")
        new, fx = hindi.repair(fixed)
        fixes += fx
    return new, fixes


def parse(pages: dict[int, list[SSpan]], images: list[PageImage], raw_text: str) -> tuple[dict, list[dict], list[str]]:
    meta = parse_meta(raw_text)
    warnings: list[str] = []
    items: list[tuple[int, float, str, object]] = []
    for pno in sorted(pages):
        for row in rows_with_scripts(pages[pno]):
            items.append((pno, row_top(row.spans), "row", row))
    for im in images:
        x0, y0, x1, y1 = im.rect
        if y0 < 50 or (im.width, im.height) in (TICK_PX, CROSS_PX) or im.width > 700 and im.height > 600:
            continue  # page logos, tick / cross icons, the background watermark
        items.append((im.page, (y0 + y1) / 2, "img", im))
    items.sort(key=lambda t: (t[0], t[1], 0 if t[2] == "row" else 1))

    qs: list[Q] = []
    cur: Q | None = None
    section: str | None = None
    passage_rows: list[str] | None = None
    passage: str | None = None
    mode = "none"  # q | opts | passage
    opt_no: int | None = None
    pending_sub: int | None = None
    for pno, y, kind, obj in items:
        if kind == "img":
            if cur is not None and mode in ("q", "opts"):
                if mode == "opts" and opt_no is not None:
                    cur.options[opt_no]["images"].append(obj)
                else:
                    cur.images.append(obj)  # type: ignore[arg-type]
            continue
        row: Row = obj  # type: ignore[assignment]
        content = [s for s in row.spans if s.x0 < META_X]
        meta_spans = [s for s in row.spans if s.x0 >= META_X]
        if meta_spans and cur is not None:
            mt = join_spans(meta_spans).strip()
            if m := re.match(r"Question ID\s*:\s*(\d+)", mt):
                cur.qid = m.group(1)
        if not content:
            continue
        t = join_spans(content).strip()
        if m := RE_SECTION.match(t):
            section = m.group(1).strip()
            passage = None
            continue
        if HEADER_ROWS.match(t) or re.fullmatch(r"\d{2}/\d{2}/\d{4}|[0-9:]+ [AP]M - [0-9:]+ [AP]M|TGT \(Computer Science\)", t):
            continue
        if t.startswith("Comprehension"):
            passage_rows, mode = [], "passage"
            continue
        if m := re.match(r"SubQuestion No\s*:\s*(\d+)", t):
            if passage_rows is not None:
                passage = "\n".join(passage_rows)
                passage_rows = None
            pending_sub = int(m.group(1))
            continue
        first = content[0]
        m_label = RE_QLABEL.match(first.text.strip()) or RE_QLABEL_INLINE.match(first.text.strip())
        if m_label and first.x0 < LABEL_X:
            if mode == "passage" and passage_rows is not None:
                passage = "\n".join(passage_rows)
                passage_rows = None
            cur = Q(section, int(m_label.group(1)), pno, passage, pno, y, y)
            cur.sub_qno, pending_sub = pending_sub, None
            if pending_sub is None and cur.sub_qno is None:
                cur.passage = None
            qs.append(cur)
            mode, opt_no = "q", None
            rest = (m_label.group(2) if m_label.re is RE_QLABEL_INLINE else "") + " " + join_spans(content[1:])
            if rest.strip():
                cur.text_rows.append(rest.strip())
            continue
        if mode == "passage" and passage_rows is not None:
            passage_rows.append(t)
            continue
        if cur is None:
            continue
        cur.page_end, cur.y_end = pno, y
        if mode == "q":
            if first.text.strip() == "Ans" and first.x0 < LABEL_X:
                mode = "opts"
                content = content[1:]
                if not content:
                    continue
                t = join_spans(content).strip()
            else:
                cur.text_rows.append(t)
                continue
        if mode == "opts":
            if (m := RE_OPT.match(t)) and content[0].x0 < 110:
                opt_no = int(m.group(1))
                cur.options[opt_no] = {"lines": [m.group(2)], "green": is_green(content[0]), "red": is_red(content[0]), "images": []}
            elif opt_no is not None:
                cur.options[opt_no]["lines"].append(t)
    return meta, [_to_raw(q, i + 1) for i, q in enumerate(qs)], warnings


def _to_raw(q: Q, qno: int) -> dict:
    issues: list[str] = []
    fixes: list[str] = []
    text, fx = _clean("\n".join(q.text_rows))
    fixes += fx
    opts = []
    for n in range(1, 5):
        o = q.options.get(n)
        if o is None:
            issues.append(f"option {n} missing")
            opts.append({"text": "", "textHi": None, "images": [], "imagesHi": []})
            continue
        # options are single phrases: a break between two Devanagari letters is a wrap inside a word ("लज्जि|त")
        ot = ""
        for line in (x.strip() for x in o["lines"] if x.strip()):
            joined = ot and _is_deva(ot[-1]) and _is_deva(line[0])
            ot += ("" if not ot or joined else " ") + line
        ot, fx = _clean(ot)
        fixes += fx
        opts.append({"text": ot, "textHi": None, "images": o["images"], "imagesHi": []})
        if not ot and not o["images"]:
            issues.append(f"option(s) [{n}] have neither text nor an image in the source")
    greens = [n - 1 for n in range(1, 5) if q.options.get(n, {}).get("green")]
    if not greens:
        issues.append("no option marked correct (green) in the source")
    if len(greens) > 1:
        issues.append(f"source marks {len(greens)} options correct: {[g + 1 for g in greens]}")
    if not q.qid:
        issues.append("Question ID not found")
    passage, pfx = _clean(q.passage) if q.passage else (None, [])
    fixes += pfx
    hi = has_devanagari(text)
    return {
        "qno": qno,
        "sectionQno": q.sec_qno,
        "sourceQid": q.qid,
        "section": q.section,
        "primaryLang": "hi" if hi else "en",
        "text": text,
        "textHi": None,
        "passage": passage,
        "options": opts,
        "images": q.images,
        "imagesHi": [],
        "answerIndices": greens,
        "officialNote": None,
        "dropped": False,
        "marks": None,
        "page": q.page,
        "pageEnd": q.page_end or q.page,
        "pageEn": q.page,
        "pageHi": None,
        "regions": {"en": [q.page, round(q.y - 4, 1), q.page_end or q.page, round(q.y_end + 24, 1)], "hi": None},
        "issues": issues,
        "hindiFixes": sorted(set(fixes)),
    }
