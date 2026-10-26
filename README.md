# Sarkari PYQ

Mobile-first apps (one installable PWA) built from real previous-year question papers:

- **Bihar STET Computer Science** (Paper II, Class 11–12): 1,500 questions from 10 papers (2023–2025). Opens at `#/`.
- **DSSSB TGT Computer Science**: 1,400 questions from 7 papers (2021–2024), with study notes, mock tests and a full verification report, in Hindi and English. Opens at `#/dsssb`.

Works offline after the first visit. To install it, use "Add to Home Screen" on a phone.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173  (DSSSB: http://localhost:5173/#/dsssb)
npm test           # TypeScript tests (both sections)
npm run build      # production build into dist/
npm run preview    # serve the production build
```

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages.

## Bihar STET

- **Questions**: search in English or Hindi, filter by subject, topic, year or paper.
- **Most repeated**: questions asked in 2 or more papers, most-asked first.
- **Practice**: Quick 20, most repeated, full 150-question mock, topic-wise, or any past paper.
- **Saved**: bookmarks, mistakes to revise, test history. Stored on the device, with backup and restore.

Rebuild: `PYTHONPATH=pipeline .venv/bin/python -m stet.build --src /path/to/stet-pdfs` (data in `public/data`).

Data notes: the scored answer is the key printed in the source paper (none is the official BSEB final key); each key was re-checked by AI review (disagreements are marked **Key disputed**, flawed questions **Ambiguous**); explanations were written by AI review.

## DSSSB TGT Computer Science

Sections: Exam info (official sources, current post code 41/26 vs historical post codes), Syllabus (official 41/26 units + study breakdown with progress), Notes (58 topics, basics to advanced), Question bank, Mock tests (+1 / −0.25), Revision (flashcards, wrong answers, formulas, quick notes), PYQ analysis, Repeated questions, Analytics, Study planner, Verification, PDF library.

### Papers

| Paper | Post code | Department | Date / shift | Key in source |
|---|---|---|---|---|
| 2021 Sets 1–5 | 91/20 | DoE | exam held 01 & 07 Aug 2021; date/shift not printed per set | DSSSB/EdCIL master paper (final-key version with official drop notes) |
| 24 Jun 2023 Shift 2 | 39/22 | DoE | printed + DSSSB schedule | DSSSB/EdCIL master paper ("Actual Answer Key: Yes") |
| 07 Feb 2024 Shift 2 | 70/23 | **NDMC** (different syllabus) | printed | Adda247 republished copy |

Plus the official scanned syllabus `pc-41-26_tgt_computer_science_in_doe.pdf` (OCR'd).

### Rebuilding the data

```bash
python3 -m venv .venv && .venv/bin/pip install pymupdf rapidfuzz numpy pytest pillow
npm run pipeline:dsssb          # = PYTHONPATH=pipeline .venv/bin/python -m dsssb.build --src /Users/apple/Documents/TGT-DSSSB
npm run pipeline:test           # Python tests (STET + DSSSB)
```

`--src` can point at any folder; it is searched recursively. OCR uses Apple Vision through a small Swift helper
that is compiled on first use (`swiftc` from the Xcode command-line tools, macOS only). Outputs:

- `public/dsssb/data/*.json`, `public/dsssb/figures/` – what the app loads
- `data/dsssb/` – full records (questions, matches, manifest, verification)
- `reports/dsssb/` – `verification_report.md`, `verification_open.csv`, `corrections.csv`, `analysis_report.md`, `repeat_report.md`, `topic_stats.csv`, `questions.csv`, `notes_coverage.md`
- `public/dsssb/pdfs/` – a *copy* of the source PDFs for local page links (git-ignored, not deployed; disable with `--no-copy-pdfs`)

The original PDFs are only read, never modified. See `pipeline/dsssb/README.md` for how extraction, OCR, Hindi
decoding, repeat detection and verification work.

### What the verification statuses mean

- **Verified**: text from the PDF (or OCR confirmed against the page image), one key marked (or DSSSB's own drop note), consistent metadata, and an independent AI solve agrees with the key.
- **Corrected**: as verified, but the extracted text was corrected against the printed page; every correction is listed with its evidence. Answer keys are never changed.
- **Disputed**: the key is in doubt (AI solve disagrees or finds the question flawed, cross-paper conflict, or the key on the page image differs). The source key is still shown, labelled as the source key.
- **Unverified**: a check could not be completed (e.g. the AI check agreed only with low confidence).
- **Dropped by DSSSB**: the paper itself says the question was ignored for all candidates; never scored.

Explanations, topic labels, difficulty and study notes are AI-assisted and labelled as such in the app.
