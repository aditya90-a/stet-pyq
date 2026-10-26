# Study notes: writing instructions

Notes are written per topic of the DSSSB TGT Computer Science taxonomy (`pipeline/dsssb/notes/plan.json`).
Each note is one JSON file `pipeline/dsssb/notes/<slug>.json`. The app renders them on the Notes page, links every
topic to its real previous-year questions automatically, and builds flashcards / formula sheets from them.

Audience: candidates for DSSSB TGT Computer Science (graduate level, BCA/B.Tech/B.Sc CS), preparing for a 200-question
objective exam (+1 / −0.25). Notes must go from basics to advanced, stay exam-focused and be factually correct.
Calibrate depth and emphasis by skimming the real questions of your subject in
`pipeline/dsssb/annotations/input/*.json` (filter by `section`). Do **not** copy those questions into the notes:
they are shown separately as PYQs. Worked examples must be your own, clearly practice problems.

## Schema

```json
{
  "slug": "<from plan.json>",
  "subject": "<from plan.json>",
  "topic": "<from plan.json>",
  "titleHi": "<Hindi title>",
  "summary": "<2-3 sentences: what this topic covers and why it matters in the exam>",
  "sections": [
    {
      "heading": "<heading>",
      "level": "basic | intermediate | advanced",
      "subtopic": "<the subtopic string from plan.json this section belongs to>",
      "body": "<text; see formatting>",
      "table": {"columns": ["..", ".."], "rows": [["..", ".."]]},
      "code": {"lang": "c | cpp | java | python | sql | html | css | javascript | bash | xml | text", "source": "<code>", "output": "<expected output or empty>"},
      "diagram": {"title": "<title>", "ascii": "<monospace diagram, max 64 chars wide>"}
    }
  ],
  "formulas": [{"name": "..", "formula": "..", "note": ".."}],
  "workedExamples": [{"problem": "..", "solution": "<step by step>"}],
  "pitfalls": ["<common mistake / exam trap>"],
  "quickRevision": ["<one-line fact>"],
  "flashcards": [{"front": "<question>", "back": "<short answer>"}],
  "glossary": [{"en": "<term>", "hi": "<Hindi term>"}]
}
```

`table`, `code` and `diagram` are optional per section; use them where they teach better than prose. Every
subtopic listed in plan.json for the topic must be covered by at least one section.

## Size and content
- Computer Science and Teaching Methodology topics: 8-14 sections, 1,200-2,200 words of `body` text in total,
  4-6 worked examples, 6-12 pitfalls, 10-15 quick-revision lines, 12-20 flashcards, 8-15 glossary terms.
  Include formulas (complexities, conversions, addressing calculations, subnetting, etc.) and real code where
  relevant, with the exact output.
- Section A topics (GA, Reasoning, Arithmetic, English, Hindi): 6-10 sections, 800-1,500 words. Reasoning and
  Arithmetic: methods, shortcuts and fully worked examples. General Awareness: stable, exam-relevant facts
  (constitution articles, geography, history, science, culture). Do not write current-affairs claims that may
  have changed; for the Current Affairs topic explain how to prepare and list stable reference facts only
  (e.g. headquarters of organisations, long-standing awards), and say that recent events must be checked in a
  current source.
- Hindi Language topics (`hindi-*` slugs): write the notes **in Hindi** (Devanagari), with English only in
  headings where useful. All other topics: English, with the glossary giving Hindi terms.

## Accuracy
- Only state facts you are sure of. Prefer textbook-standard definitions (Tanenbaum, Silberschatz, Korth,
  Morris Mano, Cormen, Pressman, NCERT/NCF for pedagogy). If a point is debated or varies by textbook, say so.
- Code must compile/run and outputs must be exact. Arithmetic in worked examples must be correct; re-check it.
- No dates or numbers of recent events, no invented statistics, no URLs.

## Formatting of `body`, `solution`, `back`
Plain text with `**bold**`, `` `code` ``, line breaks, and lines starting with `- ` for lists. No headings
inside bodies, no LaTeX: use Unicode (², ³, ⁻¹, √, ≤, ≥, ≠, →, ×, ÷, Σ, π, θ, log₂).

Validate every file after writing: `python3 -c "import json,sys;json.load(open(sys.argv[1]))" <file>`.
Write only your own note files.
