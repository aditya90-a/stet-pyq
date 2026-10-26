"""Pipeline tests: parsing & metadata, Hindi repair, normalisation, repeat classification,
answer-verification labels, validation and robustness against bad input files.

Tests that need the real PDFs are skipped when /Users/apple/Documents/Stet is not present.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import pymupdf
import pytest

from stet import build, hindi, validate
from stet.extract import extract_pdf
from stet.normalize import compact, norm
from stet.repeats import build_groups, classify_pair, literals

SRC = Path("/Users/apple/Documents/Stet")
HAS_PDFS = SRC.is_dir() and any(SRC.glob("*.pdf"))
needs_pdfs = pytest.mark.skipif(not HAS_PDFS, reason="source PDFs not available")


def q(id_, text, opts, key, paper="P1"):
    return {"id": id_, "paperId": paper, "text": text, "options": [{"label": "ABCD"[i], "text": o} for i, o in enumerate(opts)], "answerIndex": key}


# ---------------------------------------------------------------- Hindi
def test_hindi_visual_order_repair():
    fixed, fixes = hindi.repair("डेटा िमटाने और िरप्रोग्रािमंग के संदभर् में महत्वपूणर् लाभ", visual_order=True)
    assert fixed == "डेटा मिटाने और रिप्रोग्रामिंग के संदर्भ में महत्वपूर्ण लाभ"
    assert "visual-order-reordered" in fixes
    assert hindi.repair("कायर् िनमार्ण", True)[0] == "कार्य निर्माण"


def test_hindi_logical_text_untouched_and_aa_collapse():
    logical = "किस फ्लिप-फ्लॉप प्रकार को निषिद्ध स्थिति के लिए जाना जाता है"
    assert hindi.repair(logical, visual_order=False)[0] == logical
    assert hindi.repair("परिणाम क्याा है?", visual_order=False)[0] == "परिणाम क्या है?"
    assert hindi.repair("फ्लिप-फ्लॉॉप", visual_order=False)[0] == "फ्लिप-फ्लॉप"
    assert not hindi.looks_visual_order(logical)


# ---------------------------------------------------------------- normalisation / search forms
def test_norm_handles_spacing_punctuation_and_symbols():
    assert norm("Full-adder  circuit?") == "fulladder circuit"
    assert norm("Which  protocol, is used?") == "which protocol is used"
    assert norm("{ }") == "{}" and norm("[ ]") == "[]" and norm("{ }") != norm("[ ]")
    assert compact("Full -adder") == compact("full adder") == "fulladder"
    assert compact("फ़्लिप") == compact("फ्लिप")  # nukta folded for search


# ---------------------------------------------------------------- repeat classification
def scores(a, b):
    from rapidfuzz import fuzz

    return fuzz.ratio(norm(a["text"]), norm(b["text"])), fuzz.token_set_ratio(norm(a["text"]), norm(b["text"]))


def test_exact_repeat_detected():
    a = q("a", "Which protocol is used for sending emails?", ["SMTP", "POP3", "IMAP", "FTP"], 0)
    b = q("b", "Which protocol is used for sending emails ?", ["POP3", "SMTP", "IMAP", "FTP"], 1, "P2")
    r, t = scores(a, b)
    assert classify_pair(a, b, r, t, 0.9)["type"] == "exact"


def test_paraphrase_same_answer_different_distractors():
    a = q("a", "ISO 9000 and SEI CMM are both frameworks related to:", ["Software quality standards", "Networking", "Compilers", "Databases"], 0)
    b = q("b", "ISO 9000 and SEI CMM are both frameworks related to:", ["Software quality standards", "Hardware design", "Operating systems", "Graphics"], 0, "P2")
    r, t = scores(a, b)
    assert classify_pair(a, b, r, t, 0.7)["type"] == "paraphrase"


def test_same_template_different_numbers_is_not_exact():
    a = q("a", "Convert the Boolean function F(A, B, C) = Σ(2, 4, 5, 6) to its simplified SOP form.", ["A + B + C", "A'B + AC", "A + B + C'", "A'B'C"], 2)
    b = q("b", "Convert the Boolean function F(A, B, C) = Σ(0, 1, 3, 5) to its simplified SOP form.", ["A + B + C", "A'B + AC", "A + B + C'", "A'B'C"], 1, "P2")
    assert literals(a["text"]) != literals(b["text"])
    r, t = scores(a, b)
    res = classify_pair(a, b, r, t, 0.9)
    assert res is not None and res["type"] not in ("exact", "paraphrase")


def test_same_topic_different_question_not_a_repeat():
    a = q("a", "Which layer of the OSI model is responsible for routing?", ["Network", "Transport", "Session", "Physical"], 0)
    b = q("b", "Which layer of the OSI model provides encryption and compression?", ["Presentation", "Network", "Session", "Physical"], 0, "P2")
    r, t = scores(a, b)
    res = classify_pair(a, b, r, t, 0.5)
    assert res is None or res["type"] not in ("exact", "paraphrase")


def test_groups_union_find():
    pairs = [{"a": "x", "b": "y", "type": "exact"}, {"a": "y", "b": "z", "type": "exact"}, {"a": "p", "b": "q", "type": "review"}]
    g = build_groups(pairs, {"exact"})
    assert list(g.values()) == [["x", "y", "z"]]


# ---------------------------------------------------------------- answer verification labels
def _qrec(id_, key, ai=None, assessment=None, opts=("A1", "B1", "C1", "D1")):
    return {
        "id": id_, "options": [{"text": o} for o in opts],
        "answer": {"index": key, "label": "ABCD"[key] if key is not None else None},
        "aiCheck": None if ai is None else {"derivedIndex": ai, "derivedLabel": "ABCD"[ai], "confidence": "high", "assessment": assessment, "note": ""},
    }


def test_answer_status_labels():
    none_ok = _qrec("x", 1, 0, "ambiguous")
    none_ok["aiCheck"]["derivedIndex"] = None  # reviewer found no defensible option
    qs = [_qrec("v", 0, 0, "agree"), _qrec("d", 0, 2, "disagree"), _qrec("u", 1), _qrec("n", None), _qrec("amb", 1, 1, "ambiguous"), none_ok]
    conflicts = build.answer_status(qs, {})
    st = {x["id"]: x["answer"]["status"] for x in qs}
    assert st == {"v": "verified", "d": "disputed", "u": "source-key-unchecked", "n": "unavailable", "amb": "ambiguous", "x": "ambiguous"}
    assert {c["id"] for c in conflicts} == {"d", "amb", "x"}


def test_cross_paper_key_conflict_is_disputed():
    a = _qrec("a", 0, 0, "agree")
    b = _qrec("b", 1, 1, "agree", opts=("B1", "A1", "C1", "D1"))  # same question, options reordered...
    b["answer"]["index"] = 1  # ...but keyed "A1" -> same answer text: consistent
    c = _qrec("c", 2, 2, "agree")  # keyed "C1": conflict with a and b
    build.answer_status([a, b, c], {"G": ["a", "b", "c"]})
    assert a["answer"]["crossPaper"] == "conflict" and a["answer"]["status"] == "disputed"


# ---------------------------------------------------------------- robustness
def test_corrupted_and_empty_files(tmp_path):
    bad = tmp_path / "broken.pdf"
    bad.write_bytes(b"%PDF-1.4 this is not really a pdf")
    empty = tmp_path / "empty.pdf"
    empty.write_bytes(b"")
    for f in (bad, empty):
        rec = extract_pdf(f, tmp_path / "cache", tmp_path / "fig", force=True)
        assert rec["status"] != "ok" and rec["errors"]


def test_scanned_pdf_reported_as_needing_ocr(tmp_path):
    doc = pymupdf.open()
    page = doc.new_page()
    page.draw_rect(pymupdf.Rect(50, 50, 200, 200), fill=(0, 0, 0))  # an image-like page with no text layer
    p = tmp_path / "scan.pdf"
    doc.save(p)
    rec = extract_pdf(p, tmp_path / "cache", tmp_path / "fig", force=True)
    assert rec["status"] == "needs_ocr"


def test_validation_flags_missing_numbers():
    papers = {"P": {"pdf": {"pages": 5}, "metaConflicts": []}}
    base = {"text": "t", "textOrigin": "pdf-text-layer", "options": [{"label": l, "text": l} for l in "ABCD"],
            "answer": {"index": 0, "textInSource": None}, "source": {"page": 1, "pageEnd": 1}, "textHi": None,
            "hindiFixes": [], "extractionIssues": [], "explanation": {"text": "x"}, "classification": {"topic": "T"},
            "paperId": "P", "sourceQuestionId": None}
    qs = [dict(base, id=f"P-Q{n}", qno=n) for n in (1, 2, 4)]
    issues = validate.run(qs, papers, [], {"groups": {"exact": []}})
    assert any(i["code"] == "missing-question-numbers" and "3" in i["message"] for i in issues)


# ---------------------------------------------------------------- real PDFs
@needs_pdfs
@pytest.mark.parametrize(
    "name, date, shift, first_text, first_key",
    [
        ("Stet 2023-CS(shift-1)-1.pdf", "2023-09-12", 1, "What is the simplified expression for the Boolean function", 0),
        ("Stet 2024-CS(shift-1).pdf", "2024-06-11", 1, "Consider two binary numbers A = 110101 and B = 100110", 2),
        ("Bihar-STET-Class-11-12-Computer-Science-Official-Paper-II-Held-On_-03-Nov-2025-Shift-1-Eng.pdf", "2025-11-03", 1, "What is the main purpose of inheritance in OOP?", 2),
    ],
)
def test_parse_real_pdf(tmp_path, name, date, shift, first_text, first_key):
    rec = extract_pdf(SRC / name, tmp_path / "cache", tmp_path / "fig", force=True)
    assert rec["status"] == "ok"
    qs = rec["questions"]
    assert len(qs) == 150 and [x["qno"] for x in qs] == list(range(1, 151))
    assert all(len(x["options"]) == 4 for x in qs)
    assert all(x["answer_index"] is not None for x in qs)
    assert qs[0]["text"].startswith(first_text)
    assert qs[0]["answer_index"] == first_key
    assert rec["meta"]["date"] == date and rec["meta"]["shift"] == shift
    pages = rec["file"]["pages"]
    assert all(1 <= x["page"] <= x["page_end"] <= pages for x in qs)


@needs_pdfs
def test_bilingual_sheet_has_clean_hindi(tmp_path):
    rec = extract_pdf(SRC / "Stet 2024-CS(shift-3).pdf", tmp_path / "cache", tmp_path / "fig", force=True)
    hi = [x["text_hi"] for x in rec["questions"] if x["text_hi"]]
    assert len(hi) > 140
    assert rec["meta"]["hindiVisualOrderRepaired"] is True
    assert not any(hindi.looks_visual_order(t) for t in hi)
    assert all("t.me" not in x["text"] for x in rec["questions"])  # watermark removed


@needs_pdfs
def test_duplicate_file_detection(tmp_path):
    src = tmp_path / "src"
    (src / "sub").mkdir(parents=True)
    pdf = SRC / "Stet 2023-CS(shift-1)-1.pdf"
    shutil.copy(pdf, src / pdf.name)
    shutil.copy(pdf, src / "sub" / "copy-of-the-same-paper.pdf")  # recursive scan + duplicate
    res = build.run(src, tmp_path / "web", tmp_path / "data", tmp_path / "reports", copy_pdfs=False)
    manifest = json.loads((tmp_path / "data" / "pdf_manifest.json").read_text())
    assert res["papers"] == 1 and res["questions"] == 150
    assert sum(1 for e in manifest if e["status"] == "duplicate-file") == 1


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public" / "data"


@pytest.mark.skipif(not (DATA / "questions.json").exists(), reason="dataset not built")
def test_generated_dataset_integrity():
    qs = json.loads((DATA / "questions.json").read_text())
    papers = {p["id"]: p for p in json.loads((DATA / "papers.json").read_text())}
    groups = json.loads((DATA / "groups.json").read_text())
    stats = json.loads((DATA / "stats.json").read_text())
    assert stats["totals"]["questions"] == len(qs)
    ids = [x["id"] for x in qs]
    assert len(ids) == len(set(ids))
    for x in qs:
        p = papers[x["paperId"]]
        assert 1 <= x["source"]["page"] <= p["pdf"]["pages"]
        assert x["source"]["pdf"] == p["pdf"]["name"]
        if x["answer"]["index"] is not None:
            assert 0 <= x["answer"]["index"] < len(x["options"])
        for f in x["figures"]:
            assert (ROOT / "public" / f["file"]).exists()
    # repeat families never double-count a paper
    for g in groups["repeat"]:
        assert g["distinctPapers"] == len(set(next(y for y in qs if y["id"] == m)["paperId"] for m in g["members"]))
    # exact-repeat members really are near-identical
    by = {x["id"]: x for x in qs}
    from rapidfuzz import fuzz

    for g in groups["exact"]:
        t0 = norm(by[g["members"][0]]["text"])
        assert all(fuzz.ratio(t0, norm(by[m]["text"])) >= 90 for m in g["members"])
