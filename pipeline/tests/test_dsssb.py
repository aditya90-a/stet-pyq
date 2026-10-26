"""Tests for the DSSSB pipeline. Tests that read the real papers are skipped when the PDF folder is absent."""
from __future__ import annotations

import os
from pathlib import Path

import pymupdf
import pytest

from dsssb import glyphmap, papers, verify
from dsssb.parsers import digialm, edcil
from dsssb.pdf import read_images, read_spans
from dsssb.repeats import refine, same_answer, variables

SRC = Path(os.environ.get("DSSSB_SRC", "/Users/apple/Documents/TGT-DSSSB"))
needs_pdfs = pytest.mark.skipif(not SRC.exists(), reason="source PDFs not available")


# ------------------------------------------------------------------ Hindi decoding

@pytest.mark.parametrize(
    "raw, expected",
    [
        ("िनɻिलİखत मŐ से कौन सा", "निम्नलिखित में से कौन सा"),
        ("िदए गए शɨों मŐ शुȠ वतŊनी का चयन कीिजए।", "दिए गए शब्दों में शुद्ध वर्तनी का चयन कीजिए।"),
        ("अथŊʩव̾ था", "अर्थव्यवस्था"),
        ("कुसŎ हœ।", "कुर्सी हैं।"),
        ("सूयŖदय", "सूर्योदय"),
        ("Ɛोंͤिक", "क्योंकि"),
        ("राʼŌ ीय", "राष्ट्रीय"),
        ("तथा िवलंिबत", "तथा विलंबित"),
    ],
)
def test_glyph_decoding(raw, expected):
    out, fixes = glyphmap.decode(raw)
    assert out == expected
    assert "unmapped-glyph-left" not in fixes


def test_every_mapped_glyph_is_devanagari():
    for ch, (text, gid) in glyphmap.GLYPHS.items():
        assert gid > 0
        assert all("ऀ" <= c <= "ॿ" or c == "़" for c in text), (ch, text)


# ------------------------------------------------------------------ parsers on the real papers

def _parse(name, mod):
    doc = pymupdf.open(SRC / name)
    raw = "\n".join(p.get_text() for p in doc)
    return mod.parse(read_spans(doc), read_images(doc), raw)


@needs_pdfs
def test_edcil_2021_set1():
    meta, qs, warns = _parse("tgt_computer_science1.pdf", edcil)
    assert meta["paperName"] == "TGT Computer Science1"
    assert len(qs) == 200 and [q["qno"] for q in qs] == list(range(1, 201))
    assert sum(q["dropped"] for q in qs) == 3
    assert all(len(q["answerIndices"]) == 1 for q in qs if not q["dropped"])
    q106 = next(q for q in qs if q["qno"] == 106)
    # the superscript "-12" must stay with option 2 and not colour option 1 green
    assert q106["options"][1]["text"] == "10^–12 seconds"
    assert q106["answerIndices"] == [1]
    q96 = next(q for q in qs if q["qno"] == 96)
    assert q96["passage"] and "soil carbon" in q96["passage"]
    assert not any(i for q in qs for i in q["issues"])


@needs_pdfs
def test_edcil_2023_image_paper():
    meta, qs, _ = _parse("tgtcomputerscience_24th_jun_2023_shift_2.pdf", edcil)
    assert meta.get("actualAnswerKey") is True and meta["paperNameShift"] == 2
    assert len(qs) == 200
    q118 = next(q for q in qs if q["qno"] == 118)
    # option 1's label is at the foot of a page and its image at the top of the next
    assert [len(o["images"]) for o in q118["options"]] == [1, 1, 1, 1]
    assert q118["answerIndices"] == [3]
    q96 = next(q for q in qs if q["qno"] == 96)
    assert q96["passage"].startswith("दिए गए")


@needs_pdfs
def test_digialm_2024():
    meta, qs, _ = _parse("DSSSB-TGT-Computer-Science-Official-Paper-Held-On_-07-Feb-2024-Shift-2-Eng.pdf", digialm)
    assert meta["date"] == "2024-02-07" and meta["timeStart"] == "12:30 PM"
    assert len(qs) == 200
    assert all(len(q["answerIndices"]) == 1 for q in qs)
    assert all(q["sourceQid"] for q in qs)
    assert sum(1 for q in qs if q["passage"]) == 10


# ------------------------------------------------------------------ registry and metadata checks

def test_registry_checks_detect_a_wrong_mapping():
    reg = papers.PAPERS["35a2f2db"]
    ok = papers.check(reg, {"date": "2024-02-07", "timeStart": "12:30 PM", "timeEnd": "2:30 PM"}, "DSSSB-TGT-Computer-Science-Official-Paper-Held-On_-07-Feb-2024-Shift-2-Eng.pdf")
    assert all(c["result"] == "pass" for c in ok)
    bad = papers.check(reg, {"date": "2024-02-08", "timeStart": "12:30 PM", "timeEnd": "2:30 PM"}, "x.pdf")
    assert {c["field"] for c in bad if c["result"] == "fail"} == {"date", "filename"}


def test_canonical_sections():
    assert papers.canonical_section("General Ability") == ("General Intelligence & Reasoning", "A")
    assert papers.canonical_section("Discipline3") == ("Computer Science", "B")


# ------------------------------------------------------------------ repeats

def _q(i, text, opts, key=0, images=()):
    return {"id": i, "text": text, "options": [{"text": o, "images": []} for o in opts], "images": list(images), "answerIndex": key}


def test_shared_instructions_are_not_repeats(tmp_path):
    stem = "In the following question below are given some statements followed by some conclusions. Read all the conclusions and decide.\nStatements:\n"
    a = _q("a", stem + "I. Some M are B.\nII. No L is M.", ["Only I", "Only II", "Both", "Neither"])
    b = _q("b", stem + "I. Some P are K.\nII. No S is P.", ["Only I", "Only II", "Both", "Neither"])
    pairs = [{"a": "a", "b": "b", "type": "exact", "method": "auto", "scores": {}, "reason": ""}]
    refine(pairs, {"a": a, "b": b}, tmp_path)
    assert pairs[0]["type"] == "different"
    assert variables(a["text"]) != variables(b["text"])


def test_same_answer_ignores_spacing_and_suffixes():
    assert same_answer("Dot-matrix printer", "Dot matrix")
    assert not same_answer("Spiral", "Waterfall")


# ------------------------------------------------------------------ verification

def _vq(**kw):
    q = {
        "id": "p-q001", "paperId": "p", "qno": 1, "sourceQid": "1", "lang": "en", "textOrigin": "pdf-text-layer",
        "options": [{"label": L, "text": "x", "textHi": None, "images": []} for L in "ABCD"],
        "keyRaw": [1], "dropped": False, "officialNote": None, "extractionIssues": [], "hindiFixes": [],
        "source": {"pdf": "p.pdf", "page": 1, "pageEnd": 1, "pageHi": None},
        "answer": {"crossPaper": "none"}, "repeat": {"withinPaper": []},
        "aiCheck": {"derivedIndex": 1, "derivedLabel": "B", "confidence": "high", "assessment": "agree", "note": ""},
        "corrections": [], "verificationNotes": [],
    }
    q.update(kw)
    return q


PAPER = {"p": {"label": "P", "metaChecks": [], "answerKey": {}}}


def test_status_verified_disputed_unverified_corrected():
    qs = [
        _vq(id="v"),
        _vq(id="d", aiCheck={"derivedIndex": 2, "derivedLabel": "C", "confidence": "high", "assessment": "disagree", "note": "n"}),
        _vq(id="u", aiCheck=None),
        _vq(id="c", corrections=[{"field": "text", "kind": "content"}]),
        _vq(id="o", textOrigin="ocr"),
        _vq(id="x", keyRaw=[], dropped=True, officialNote="ignored for all candidates", aiCheck=None),
    ]
    verify.run(qs, PAPER, {})
    st = {q["id"]: q["verification"]["status"] for q in qs}
    assert st == {"v": "verified", "d": "disputed", "u": "unverified", "c": "corrected", "o": "unverified", "x": "verified"}


def test_correction_records_evidence_and_ignores_spacing():
    q = _vq()
    assert verify.correction("text", "INCORRECI", "INCORRECT", q, "OCR")["kind"] == "content"
    assert verify.correction("text", "a  b", "a b", q, "OCR")["kind"] == "formatting"
    assert verify.correction("text", "same", "same", q, "OCR") is None
