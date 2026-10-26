# STET PYQ

A mobile-first app (installable PWA) for **Bihar STET Computer Science (Paper II, Class 11–12)** previous-year questions. It is built from the actual question papers: 1,500 questions from 10 papers (2023–2025).

- **Questions**: search in English or Hindi, filter by subject, topic, year or paper.
- **Most repeated**: questions asked in 2 or more papers, most-asked first.
- **Practice**: Quick 20, most repeated, full 150-question mock, topic-wise, or any past paper. Answers and explanations appear as you go, or after you submit in a mock.
- **Saved**: bookmarks, mistakes to revise, test history. Stored on the device, with backup and restore.

Works offline after the first visit. To install it, use "Add to Home Screen" on a phone.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # TypeScript tests
npm run build      # production build into dist/
```

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages.

## Rebuilding the data from the PDFs

The generated dataset is committed in `public/data`. To regenerate it from a folder of the source PDFs:

```bash
python3 -m venv .venv && .venv/bin/pip install pymupdf rapidfuzz numpy pytest pillow
PYTHONPATH=pipeline .venv/bin/python -m stet.build --src /path/to/pdfs
npm run pipeline:test
```

Source PDFs are not part of this repository or the website. The pipeline only reads them.

## Data notes

- The answer scored in tests is always the key printed or marked in the source paper. None of the sources is the official BSEB final key.
- Each key was independently re-checked by AI review. Questions where the check disagrees are marked **Key disputed**; flawed questions are marked **Ambiguous**.
- Explanations were written by AI review.
- "Asked 3×" means the question appears in 3 different papers, either identically or reworded. Past repeats do not predict future papers.
