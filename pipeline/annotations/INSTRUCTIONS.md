# Annotation instructions (AI-assisted review layer)

The extraction pipeline produces questions, options and the answer key printed in each source PDF.
This annotation layer adds things a PDF does not contain: topic classification, difficulty, an
independent answer check and an explanation. Everything produced here is shown in the app as
**AI-generated / AI-assessed** and never replaces the source key.

## A. Question annotation  (`input/batch_NN.json` → `ai/annot_NN_P.json`)

Each input item is one *unique* question (`copies` lists every paper where the identical question
appears). For every item, write one output object:

```json
{
  "id": "<same id as input>",
  "subject": "<a top-level key of TAXONOMY in pipeline/stet/taxonomy.py>",
  "topic": "<exact topic key under that subject>",
  "subtopic": "<exact subtopic string under that topic>",
  "concept": "<specific concept label, see below>",
  "difficulty": "easy | medium | hard",
  "derivedAnswer": "A | B | C | D | null",
  "derivedConfidence": "high | medium | low",
  "keyAssessment": "agree | disagree | ambiguous",
  "keyNote": "<empty, or 1-3 sentences explaining a disagreement / flaw>",
  "explanation": "<explanation text>"
}
```

Rules:

1. **Subject**: `sectionSubject` "Computer Science" → `Computer Science` (general computer-awareness
   questions go to topic `Computer Fundamentals (not a listed unit)`); "Art of Teaching" → `Art of Teaching`;
   "General Knowledge / Aptitude" → choose one of `General Knowledge`, `Environmental Science`,
   `Mathematical Aptitude`, `Logical Reasoning`.
2. **Topic / subtopic** must be copied *exactly* from `TAXONOMY` (same spelling, punctuation and case).
3. **Concept**: a short (3–8 words), *specific* label for the exact fact, rule or skill being tested,
   e.g. `Full adder number of inputs`, `Two's complement subtraction`, `Device operating at network layer`,
   `K-map SOP minimisation`, `Bloom's affective domain order`. Not a topic name. Two questions that test
   the same fact/rule should receive the same label, so prefer plain canonical wording.
4. **Difficulty**: easy = direct recall of a common fact; medium = needs understanding, application or a
   less common fact; hard = multi-step reasoning/calculation or an obscure detail.
5. **Answer check**: solve the question yourself *before* looking at `sourceKey`. Put your answer in
   `derivedAnswer`. Then compare: `agree` if it matches; `disagree` if you are confident the key is wrong
   (explain in `keyNote`); `ambiguous` if the question is flawed (no correct option, several defensible
   options, missing/garbled text). If `keyTextsAcrossCopies` is present, different papers keyed different
   answers — mention that in `keyNote`. Use `null` only if the question cannot be answered at all.
6. **Explanation** (60–170 words, English): explain *why* the correct option is correct; for
   numerical, logic, K-map, automata or code questions show the working step by step; add a short
   "Why not the others" list when it helps. If you disagree with the key, explain the correct answer
   and state plainly that the source key marks a different option. If unsure about a fact, say so
   rather than inventing details. Formatting allowed: `**bold**`, `` `code` ``, line breaks and lines
   starting with `- `. No headings, no LaTeX (use Unicode such as Σ, ≤, →, ′).
7. If `figure` is set, view the image at `public/<figure>` before answering.

Write the output as JSON arrays in files of at most ~30 objects:
`pipeline/annotations/ai/annot_<NN>_<P>.json` (NN = batch number, P = part 1,2,3…), each a valid JSON array.
After writing each file, check it parses: `python3 -c "import json,sys;json.load(open(sys.argv[1]))" <file>`.
Do not edit any other file.

## B. Match adjudication  (`input/pairs_NN.json` → `ai/pairs_NN.json`)

Each item is a pair of questions from different papers that the similarity rules could not classify.
Decide:

- `paraphrase` – the same question with the same expected answer (wording reordered/reworded, or the
  same stem with different distractor options).
- `concept` – different questions that test the same specific concept, rule, formula or fact (e.g. the
  same K-map method with different minterms, or a definition asked in the reverse direction).
- `different` – they only share a topic or keywords, or ask about different facts.

Never call a pair `paraphrase` just because the topic or answer word is shared. Output a JSON array of
`{"a": "<id>", "b": "<id>", "verdict": "paraphrase|concept|different", "reason": "<= 25 words"}`.
