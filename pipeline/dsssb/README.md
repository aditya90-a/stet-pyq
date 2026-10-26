# DSSSB pipeline

```
extract.py   PDF → questions (cached per file hash in pipeline/cache/dsssb/), figures, Apple Vision OCR
parsers/     edcil.py (2021 sets, 2023: EdCIL/Digialm master papers), digialm.py (2024 Adda247 copy)
glyphmap.py  decoding of the broken Nirmala UI Hindi in the 2021 sheets
layout.py    rows with superscripts/subscripts folded in (10^-12, log_2 n)
papers.py    paper registry with provenance (post code, dates, shifts, key source) + metadata checks
assemble.py  stable question ids, review images
prep.py      AI-review batches (annotations/input/)
repeats.py   DSSSB refinements on top of stet/repeats.py
verify.py    per-question checks and the verified / corrected / disputed / unverified status
syllabus.py  official syllabus (OCR + checked transcription) and exam information
reports.py   statistics, verification report, Markdown/CSV reports
build.py     everything together → public/dsssb/data, data/dsssb, reports/dsssb
```

## Extraction

- **Answer key**: the colour of each option's own "N." label (green = key). Continuation rows and super/subscripts
  never set the key; a misplaced green superscript once made two options look correct, which is why this matters.
  The 2023 and 2021 sheets print each question twice (English + Hindi); both blocks must mark the same option
  (`key-bilingual` check). Reviewers also read the key off the page image (`key-image` check).
- **Official notes**: "discrepancy is found in question/answer. So, this question is ignored for all candidates"
  is captured verbatim; such questions are *dropped* (16 in the 2021 sets) and never scored.
- **Comprehension**: the passage block ("Question Type : COMPREHENSION … Question Numbers : (96 to 100)") is
  attached to every sub-question in its range.
- **Images**: every figure and image-only question/option (all of the 2023 paper) is rendered to
  `public/dsssb/figures/`. English images are OCR'd with Apple Vision (`vision_ocr.swift`); every OCR'd question
  was then compared with its page image by the review layer, and each change is recorded as a correction with
  the page as evidence.

## Hindi in the 2021 sheets

The embedded Nirmala UI subset maps conjunct glyphs to arbitrary Latin-Extended code points (e.g. `ɨ` = ब्द,
`Ő` = ें) and stores text in visual order. Each of the 199 code points was identified by drawing its glyph id
alone from the embedded font (a one-page PDF that reuses the font resource) and reading it in the context of the
printed line; the mapping (with glyph ids) is in `glyphmap.py`. Composite reph glyphs are written as
"<matra>र्" so that `stet.hindi.repair` moves the reph before its syllable. The 2023 Noto Devanagari text is
also stored in visual order and gets the same repair; the 2024 Type3 Hindi gets danda/duplicate-sign fixes.

## Repeats

`stet.repeats.find_pairs` proposes pairs; DSSSB papers share long instructions (syllogisms, seating puzzles) and
figure questions share words, so `repeats.refine` keeps an exact/paraphrase match only if the question-specific
tail and its single-letter terms match and any figures look the same (average hash). Borderline pairs were
adjudicated by AI review (`annotations/ai/pairs_*.json`). Cross-paper key consistency is only compared between
copies that have the same option set.

## AI review layer

`annotations/INSTRUCTIONS.md` defines it: transcription check against the page image (visual batches), topic
classification against `taxonomy.py`, an independent solve (before looking at the key), and an explanation. It
never replaces the source key. Manual classification fixes go in `annotations/overrides.json` (answer keys
cannot be overridden). Study notes are written per `notes/INSTRUCTIONS.md`.
