# DSSSB TGT Computer Science: AI review instructions

The pipeline extracts each question, its options and the key printed in the source paper. This review layer
adds what a PDF cannot give: a check of the text against the printed page (for OCR'd or repaired text), a
topic classification, an independent answer check and an explanation. The app labels everything produced
here as **AI review**. It never replaces the source key; a disagreement is shown as a dispute with your reasoning.

Inputs live in `pipeline/dsssb/annotations/input/`. Write outputs to `pipeline/dsssb/annotations/ai/` using
the **same file name** as the input (e.g. `visual_03.json` → `ai/visual_03.json`). Each output file is a JSON array
with one object per input item, in the same order. After writing, check it parses:
`python3 -c "import json,sys;json.load(open(sys.argv[1]))" <file>`. Do not edit any other file.

## A. Question batches (`visual_NN.json`, `text_NN.json`)

Each item is one *unique* question; `copies` lists the identical question in other papers.

```json
{
  "id": "<same id>",
  "transcription": { ... },          // visual batches ONLY (see below)
  "subject": "<top-level key of taxonomy.json>",
  "topic": "<exact topic key under that subject>",
  "subtopic": "<exact subtopic string under that topic>",
  "concept": "<3-8 word label of the specific fact/rule/skill tested>",
  "difficulty": "easy | medium | hard",
  "derivedAnswer": "A | B | C | D | null",
  "derivedConfidence": "high | medium | low",
  "keyAssessment": "agree | disagree | ambiguous",
  "keyNote": "<empty, or 1-3 sentences on a disagreement / flaw>",
  "explanation": "<explanation>"
}
```

### Transcription (visual batches only)

Open the image at `reviewImage` (path relative to the repo root) with the Read tool. It shows the question
exactly as printed. The given `text` / `options` came from OCR, a repaired Hindi font, or a text layer next to a
figure. Compare them with the image and return:

```json
"transcription": {
  "verdict": "match | corrected | unreadable",
  "text": "<question text exactly as printed>",
  "options": ["<option 1>", "<option 2>", "<option 3>", "<option 4>"],
  "keyInImage": "A | B | C | D | none | multiple",
  "figureDescription": "<empty, or one sentence describing a diagram/table that the text cannot carry>",
  "printedErrors": "<empty, or typos/mistakes that are printed in the paper itself>",
  "changes": "<empty, or a short list of what you changed, e.g. 'INCORRECI→INCORRECT; il→ii'>"
}
```

Rules:
1. Transcribe **what is printed**, character for character in meaning. Fix only OCR/extraction errors. If the
   paper itself has a typo (e.g. "D, E and E" where F is meant), keep it in `text` and describe it in `printedErrors`.
2. Language: English questions → English text. Questions of the Hindi-language section → the Hindi text
   (Unicode Devanagari). Ignore the Hindi translation block of English questions.
3. Keep line breaks for statement lists (I., II., i), ii)), code and match-the-following lists (one item per
   line; join matched columns with " | "). Superscripts as `^` (10^-12, x^2), subscripts as `_` (log_2 n,
   (1071)_10). Use Unicode symbols (→, ≤, ×, √, π).
4. `keyInImage`: the option shown with the green tick / green text in the image. This independently checks the
   extracted key, so read it from the image, not from `sourceKey`.
5. `verdict`: `match` if the given text needed no change (spacing/punctuation-only differences count as match),
   `corrected` if you changed any word, number or symbol, `unreadable` if the image cannot be read.
6. If the question depends on a figure (Venn diagram, circuit, table drawn as an image), keep the printed words
   in `text` and put a one-sentence description in `figureDescription`.

### Classification
7. `subject`: questions in the GA, Reasoning, Arithmetic, Hindi and English sections take those subjects. For
   Section B ("Computer Science" in the input), choose `Computer Science` or `Teaching Methodology` (pedagogy,
   child development, assessment, inclusive education, education policy).
8. `topic` and `subtopic` must be copied **exactly** from `pipeline/dsssb/annotations/taxonomy.json`.
9. `concept`: a short, specific, canonical label for the exact fact or skill, e.g. `Bubble sort worst-case
   complexity`, `Picosecond to seconds`, `Deadlock condition: mutual exclusion`, `Hindi: विलोम of सम्मान`,
   `Piaget pre-operational stage age`. Two questions testing the same fact should get the same label.
10. `difficulty`: easy = direct recall of a common fact; medium = understanding, application or a less common
    fact; hard = multi-step reasoning or calculation, or an obscure detail.

### Answer check
11. Solve the question yourself **before** looking at `sourceKey`, and put your answer in `derivedAnswer`.
    Then compare: `agree` if it matches; `disagree` if you are confident the key is wrong (explain in
    `keyNote`); `ambiguous` if the question is flawed (no correct option, more than one defensible option,
    missing or garbled text). For current-affairs or fact questions you cannot be sure of, use confidence
    `low` or `medium` rather than guessing. `null` only if it cannot be answered at all.
12. If `officialNote` says DSSSB ignored the question for all candidates, still solve it if you can and
    explain what the discrepancy probably was.
13. If `keysAcrossCopies` is present, different papers keyed different answers: say so in `keyNote`.

### Explanation
14. 60-170 words. Explain why the correct option is correct. For numerical, logic, reasoning, K-map, code,
    SQL or algorithm questions show the working step by step. Add a short "Why not the others" list when it
    helps. If you disagree with the key, explain the correct answer and state plainly that the source key marks
    a different option. If you are unsure of a fact, say so; never invent details or sources.
15. Language: English, except questions of the Hindi-language section, which get the explanation in Hindi.
16. Formatting allowed: `**bold**`, `` `code` ``, line breaks and lines starting with `- `. No headings, no
    LaTeX (use Unicode such as Σ, ≤, →, ′, ², ⁻¹).

## B. Pair batches (`pairs_NN.json`)

Each item is a pair of questions from different papers (or the same paper) that the similarity rules could not
classify. Decide:

- `paraphrase`: the same question with the same expected answer (reordered/reworded, or the same stem with
  different distractors).
- `concept`: different questions that test the same specific concept, rule, formula or fact.
- `different`: they only share a topic or keywords, or ask about different facts.

Never call a pair `paraphrase` just because the topic or the answer word is shared. Output a JSON array of
`{"a": "<id>", "b": "<id>", "verdict": "paraphrase|concept|different", "reason": "<= 25 words"}`.
