"""Parser for DSSSB master question papers rendered by EdCIL / Digialm ("Notations: options shown in
green colour and with a tick icon are correct").  Used by the 2021 (post code 91/20) and 24 Jun 2023
(post code 39/22) TGT Computer Science papers.

Layout: section info pages ("<Section name>" / "Section Id :" ...), then for every question a header
"Question Number : N Question Id : Q ..." / "Correct Marks : 1 Wrong Marks : 0.25", the question body,
"Options :" and four numbered options whose label is printed green (key) or red.  Each Question Id appears
twice: the English block and then the Hindi block (both Hindi in the Hindi-language section).  In the 2023
paper the question body and the options are images (screenshots of the typed question).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from stet import hindi
from stet.pdfutil import PageImage, Row, Span, has_devanagari, join_spans

from .. import glyphmap
from ..layout import rows_with_scripts
from ..pdf import row_bottom, row_top

FMT = "edcil_master_paper"

RE_HEAD = re.compile(r"^Question Number\s*:\s*(\d+)\s*Question Id\s*:\s*(\d+)")
RE_MARKS = re.compile(r"Correct Marks\s*:\s*([\d.]+)\s*Wrong Marks\s*:\s*([\d.]+)")
RE_OPT = re.compile(r"^([1-4])\.\s*(.*)$", re.S)
HEAD_CONT = re.compile(r"^(Orientation\s*:|None Response Time|Correct Marks\s*:)")
META_ROW = re.compile(
    r"^(Group Number|Group Id|Group Maximum|Group Minimum|Group Marks|Show Attended|Edit Attended|Break time|"
    r"Is this Group|Section Id|Section Number|Section type|Section Negative|Section Marks|Mandatory or Optional|"
    r"Number of Questions|Enable Mark|Clear Response|Sub-Section|Question Shuffling|Maximum Instruction|"
    r"Is Section Default|Examiner permission|Show Progress|Calculator|Magnifying|Ruler|Eraser|Scratch|Rough|"
    r"Protractor|Show Watermark|Highlighter|Auto Save|Change Font|Change Background|Change Theme|Help Button|"
    r"Show Reports|Question Paper Name|Subject Name|Creation Date|Duration|Total Marks|Display Marks|"
    r"Actual Answer Key|Notations|Options shown|icon are|Print$|Education Consultant)\b"
)
SECTION_FOLLOWERS = ("Section Id", "Section type", "Group Number")
RE_COMPREHENSION = re.compile(r"^Question Id\s*:\s*\d+")
RE_RANGE = re.compile(r"Question Numbers\s*:\s*\((\d+)\s*to\s*(\d+)\)")
PASSAGE_META = re.compile(r"^(Questions\s*:|Sub questions|Question Type|Group Comprehension|Think Time|None Response Time|Is Question Mandatory|Calculator\s*:|Minimum Instruction)")
ICON_PX = (16, 16)  # the tick / cross icons (intrinsic pixel size)


def is_green(s: Span) -> bool:
    r, g, b = s.rgb
    return g >= 100 and g > r + 50 and g > b + 50


def is_red(s: Span) -> bool:
    r, g, b = s.rgb
    return r >= 180 and r > g + 80


@dataclass
class Block:
    qno: int
    qid: str
    section: str | None
    page: int
    y: float
    page_end: int = 0
    y_end: float = 0.0
    marks: tuple[float, float] | None = None
    text_rows: list[list[Span]] = field(default_factory=list)
    images: list[PageImage] = field(default_factory=list)
    options: dict[int, dict] = field(default_factory=dict)
    note: list[str] = field(default_factory=list)
    passage: dict | None = None
    opt_images: list[PageImage] = field(default_factory=list)

    def assign_option_images(self) -> None:
        """An option image belongs to the option whose "N." label row overlaps it vertically on the same
        page (short images are top-aligned with the label, tall ones bottom-aligned)."""
        for im in self.opt_images:
            best, target = 1e9, None
            for n, o in self.options.items():
                pg, y0, y1 = o["label"]
                if pg != im.page:
                    continue
                if y0 <= im.rect[3] + 4 and y1 >= im.rect[1] - 4:
                    d = abs((y0 + y1) / 2 - (im.rect[1] + im.rect[3]) / 2)
                    if d < best:
                        best, target = d, n
            if target is None:
                # label at the foot of one page, its image at the top of the next
                before = [(o["label"][0], o["label"][1], n) for n, o in self.options.items()
                          if not o["images"] and (o["label"][0], o["label"][1]) < (im.page, im.rect[1])]
                target = max(before)[2] if before else None
            if target is None:
                self.images.append(im)  # not beside any option: treat as part of the question
            else:
                self.options[target]["images"].append(im)

    def text(self) -> str:
        return "\n".join(join_spans(r).strip() for r in self.text_rows if join_spans(r).strip())

    def deva(self) -> float:
        spans = [s for r in self.text_rows for s in r] + [s for o in self.options.values() for r in o["rows"] for s in r]
        total = sum(len(s.text.strip()) for s in spans) or 1
        return sum(len(s.text.strip()) for s in spans if s.is_deva_font or has_devanagari(s.text)) / total


def parse_meta(all_text: str) -> dict:
    meta: dict = {}
    if m := re.search(r"Question Paper Name\s*:\s*\n?\s*(.+)", all_text):
        meta["paperName"] = m.group(1).strip()
    if m := re.search(r"Creation Date\s*:\s*\n?\s*([\d-]+ [\d:]+)", all_text):
        meta["creationDate"] = m.group(1)
    if m := re.search(r"Duration\s*:\s*\n?\s*(\d+)", all_text):
        meta["durationMin"] = int(m.group(1))
    if m := re.search(r"Total Marks\s*:\s*\n?\s*(\d+)", all_text):
        meta["totalMarks"] = int(m.group(1))
    if re.search(r"Actual Answer Key\s*:\s*\n?\s*Yes", all_text):
        meta["actualAnswerKey"] = True
    if m := re.search(r"(\d{1,2})(?:st|nd|rd|th)\s+(\w{3})\w*\s+(\d{4})\s+Shift\s*(\d)", meta.get("paperName", ""), re.I):
        meta["paperNameDate"] = f"{m.group(1)} {m.group(2)} {m.group(3)}"
        meta["paperNameShift"] = int(m.group(4))
    meta["sectionCounts"] = [int(x) for x in re.findall(r"Number of Questions\s*:\s*\n\s*(\d+)", all_text)]
    return meta


def _stream(pages: dict[int, list[Span]], images: list[PageImage]) -> list[tuple[str, int, float, object]]:
    """Rows and images of every page in reading order."""
    items: list[tuple[str, int, float, object]] = []
    by_page: dict[int, list[PageImage]] = {}
    for im in images:
        by_page.setdefault(im.page, []).append(im)
    for pno in sorted(pages):
        # rows by their top edge, images by their centre: an option image starts a few points above its
        # "1." label row but belongs to it
        for row in rows_with_scripts(pages[pno]):
            items.append(("row", pno, row_top(row.spans), row))
        for im in by_page.get(pno, []):
            items.append(("img", pno, (im.rect[1] + im.rect[3]) / 2, im))
    items.sort(key=lambda t: (t[1], t[2], 0 if t[0] == "row" else 1))
    return items


def parse(pages: dict[int, list[Span]], images: list[PageImage], raw_text: str) -> tuple[dict, list[dict], list[str]]:
    meta = parse_meta(raw_text)
    warnings: list[str] = []
    stream = _stream(pages, images)
    rows = [(i, it) for i, it in enumerate(stream) if it[0] == "row"]
    # section headings: a row directly followed by "Section Id :", "Section type :" or "Group Number :"
    section_at: dict[int, str] = {}
    for k in range(len(rows) - 1):
        i, it = rows[k]
        nxt = rows[k + 1][1][3].text.strip()
        t = it[3].text.strip()
        if nxt.startswith(SECTION_FOLLOWERS) and not META_ROW.match(t) and not RE_HEAD.match(t):
            section_at[i] = t

    blocks: list[Block] = []
    cur: Block | None = None
    section: str | None = None
    mode = "none"  # head | body | opts | meta | passage
    opt_no: int | None = None
    passage: dict | None = None  # comprehension passage shared by the sub-questions in its range
    for i, (kind, pno, y, obj) in enumerate(stream):
        if kind == "img":
            im: PageImage = obj  # type: ignore[assignment]
            if mode == "passage" and passage is not None and (im.width, im.height) != ICON_PX:
                passage["images"].append(im)
                continue
            if cur is None or mode in ("none", "meta", "head") or (im.width, im.height) == ICON_PX:
                continue  # icons and anything outside a question
            if mode == "opts":
                cur.opt_images.append(im)
            else:
                cur.images.append(im)
            cur.page_end, cur.y_end = pno, im.rect[3]
            continue
        row: Row = obj  # type: ignore[assignment]
        t = row.text.strip()
        if i in section_at:
            section = section_at[i]
            mode = "meta"
            continue
        if RE_COMPREHENSION.match(t) and not RE_HEAD.match(t):
            passage, mode = {"rows": [], "images": [], "range": None}, "passage"
            continue
        if mode == "passage" and passage is not None:
            if m := RE_RANGE.search(t):
                passage["range"] = (int(m.group(1)), int(m.group(2)))
            elif not PASSAGE_META.match(t):
                passage["rows"].append(row.spans)
            if not RE_HEAD.match(t):
                continue
        if m := RE_HEAD.match(t):
            cur = Block(int(m.group(1)), m.group(2), section, pno, y)
            if passage and passage["range"] and passage["range"][0] <= cur.qno <= passage["range"][1]:
                cur.passage = passage
            blocks.append(cur)
            mode, opt_no = "head", None
            if mm := RE_MARKS.search(t):
                cur.marks = (float(mm.group(1)), float(mm.group(2)))
                mode = "body"
            continue
        if cur is None:
            continue
        if mode == "head":
            if mm := RE_MARKS.search(t):
                cur.marks = (float(mm.group(1)), float(mm.group(2)))
                mode = "body"
            elif not HEAD_CONT.match(t) and not t.startswith(("Minimum Instruction", "Orientation")):
                mode = "body"  # header without a marks line
            else:
                continue
            if mode == "body" and RE_MARKS.search(t):
                continue
        if META_ROW.match(t):
            mode = "meta"
            continue
        if mode == "meta":
            continue
        cur.page_end, cur.y_end = pno, y
        if t in ("Options :", "Options:"):
            mode = "opts"
            continue
        if mode == "body" and t.startswith("Note:") or mode == "note":
            # DSSSB's own remark on the question (e.g. "...this question is ignored for all candidates")
            cur.note.append(t)
            mode = "note"
            continue
        if mode == "body":
            cur.text_rows.append(row.spans)
            continue
        if mode == "opts":
            first = row.spans[0]
            if (m := RE_OPT.match(t)) and first.x0 < 60:
                opt_no = int(m.group(1))
                body = row.spans[1:] if re.fullmatch(r"\s*[1-4]\.\s*", first.text) else row.spans
                # the key is read from the colour of the option's own "N." label only
                cur.options[opt_no] = {
                    "rows": [body] if body else [],
                    "green": is_green(first),
                    "red": is_red(first),
                    "images": [],
                    "label": (pno, row_top(row.spans), row_bottom(row.spans)),
                }
            elif opt_no is not None:
                cur.options[opt_no]["rows"].append(row.spans)
    return meta, _pair_blocks(blocks, warnings), warnings


def _decode(spans_rows: list[list[Span]]) -> tuple[str, list[str]]:
    fixes: list[str] = []
    lines = []
    for r in spans_rows:
        t = join_spans(r).strip()
        if any("nirmala" in s.font.lower() for s in r):  # only the 2021 sheets use the encoded font
            t, fx = glyphmap.decode(t)
            fixes += fx
        elif has_devanagari(t):
            t, fx = hindi.repair(t, visual_order=True)  # EdCIL stores Devanagari in visual order
            fixes += fx
        if t:
            lines.append(t)
    return "\n".join(lines), sorted(set(fixes))


def _block_payload(b: Block) -> dict:
    b.assign_option_images()
    text, fixes = _decode(b.text_rows)
    opts = []
    for n in range(1, 5):
        o = b.options.get(n)
        if o is None:
            opts.append(None)
            continue
        ot, ofx = _decode(o["rows"])
        fixes += ofx
        # option text may start with the label span when the label and text share one span
        ot = re.sub(r"^[1-4]\.\s*", "", ot) if re.match(r"^[1-4]\.\s", ot) else ot
        opts.append({"text": ot, "green": o["green"], "red": o["red"], "images": o["images"]})
    end_page = b.page_end or b.page
    bottom = b.y_end if end_page > b.page else max(b.y_end, b.y)
    region = [b.page, round(b.y, 1), end_page, round(bottom + 22, 1)]
    ptext, pimages = None, []
    if b.passage:
        ptext, pfx = _decode(b.passage["rows"])
        fixes += pfx
        pimages = b.passage["images"]
    return {"text": text, "options": opts, "images": b.images, "deva": b.deva(), "fixes": sorted(set(fixes)), "note": " ".join(b.note),
            "region": region, "passage": ptext or None, "passageImages": pimages}


def _pair_blocks(blocks: list[Block], warnings: list[str]) -> list[dict]:
    """Merge the English and Hindi blocks of each Question Id into one raw question."""
    order: list[str] = []
    by_qid: dict[str, list[Block]] = {}
    for b in blocks:
        if b.qid not in by_qid:
            order.append(b.qid)
        by_qid.setdefault(b.qid, []).append(b)
    out = []
    for qid in order:
        bs = by_qid[qid]
        issues: list[str] = []
        if len(bs) != 2:
            issues.append(f"expected 2 language blocks for Question Id {qid}, found {len(bs)}")
        p = [_block_payload(b) for b in bs]
        b0 = bs[0]
        en, hi = p[0], (p[1] if len(p) > 1 else None)
        # 2021 sheets print English first; when the first block is Devanagari the question is Hindi-only
        primary_lang = "hi" if en["deva"] > 0.5 else "en"
        if hi is not None and en["deva"] > 0.5 and hi["deva"] < 0.5:
            en, hi = hi, en
            primary_lang = "en"
        # the English-language section prints its question twice in English: there is no Hindi version
        second_is_hindi = hi is not None and "English" not in (b0.section or "")
        greens = [i for i, o in enumerate(en["options"]) if o and o["green"]]
        greens_hi = [i for i, o in enumerate(hi["options"]) if o and o["green"]] if hi else greens
        note = en["note"] or (hi or {}).get("note", "")
        dropped = bool(re.search(r"ignored for all candidates", note))
        if not greens and not dropped:
            issues.append("no option marked correct (green) in the source")
        if len(greens) > 1:
            issues.append(f"source marks {len(greens)} options correct: {[g + 1 for g in greens]}")
        if hi is not None and greens != greens_hi:
            issues.append(f"English block marks option(s) {[g + 1 for g in greens]} but Hindi block marks {[g + 1 for g in greens_hi]}")
        if any(o is None for o in en["options"]):
            issues.append("fewer than 4 options found")
        empty = [i + 1 for i, o in enumerate(en["options"]) if o and not o["text"].strip() and not o["images"]]
        if empty:
            issues.append(f"option(s) {empty} have neither text nor an image in the source")
        if not en["text"].strip() and not en["images"]:
            issues.append("question has neither text nor an image in the source")
        if bs[0].marks and bs[0].marks != (1.0, 0.25):
            issues.append(f"unusual marking scheme {bs[0].marks}")
        out.append(
            {
                "qno": b0.qno,
                "sourceQid": qid,
                "section": b0.section,
                "primaryLang": primary_lang,
                "text": en["text"],
                "textHi": hi["text"] if second_is_hindi else None,
                "passage": en["passage"],
                "passageHi": hi["passage"] if second_is_hindi and primary_lang == "en" else None,
                "passageImages": en["passageImages"],
                "options": [
                    {
                        "text": (o or {}).get("text", ""),
                        "textHi": (h or {}).get("text") if second_is_hindi else None,
                        "images": [im for im in (o or {}).get("images", [])],
                        "imagesHi": [im for im in (h or {}).get("images", [])] if second_is_hindi else [],
                    }
                    for o, h in zip(en["options"], hi["options"] if hi else [None] * 4)
                ],
                "images": en["images"],
                "imagesHi": hi["images"] if second_is_hindi else [],
                "answerIndices": greens,
                "officialNote": note or None,
                "dropped": dropped,
                "marks": list(b0.marks) if b0.marks else None,
                "page": min(b.page for b in bs),
                "pageEnd": max(b.page_end or b.page for b in bs),
                "pageEn": bs[0].page,
                "pageHi": bs[1].page if len(bs) > 1 else None,
                "regions": {"en": en["region"], "hi": hi["region"] if hi else None},
                "issues": issues,
                "hindiFixes": sorted(set((hi or {}).get("fixes", []) + en["fixes"])),
            }
        )
    if len(out) != len({q["qno"] for q in out}):
        warnings.append("duplicate question numbers")
    return out
