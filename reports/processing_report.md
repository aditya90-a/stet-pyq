# PDF processing report

Generated: 2026-10-26T11:34:36+00:00 · pipeline v1.0.1 · source: `/Users/apple/Documents/Stet`

| Metric | Value |
|---|---|
| filesDiscovered | 11 |
| pdfsDiscovered | 10 |
| pdfsProcessed | 10 |
| pdfsFailed | 0 |
| duplicateFiles | 0 |
| pagesTotal | 549 |
| questions | 1500 |
| uniqueAfterExactOnly | 1167 |
| uniqueQuestions | 1136 |
| papers | 10 |

## Files

| File | Status | Format | Pages | Questions | Paper ID | Notes |
|---|---|---|---|---|---|---|
| Bihar-STET-Class-11-12-Computer-Science-Official-Paper-II-Held-On_-03-Nov-2025-Shift-1-Eng.pdf | ok | digialm_response_sheet | 56 | 150 | 2025-11-03-S1 |  pages without questions (covers/adverts): [1, 2, 3, 54, 55] |
| Bihar-STET-Class-11-12-Computer-Science-Official-Paper-II-Held-On_-03-Nov-2025-Shift-2-Eng.pdf | ok | digialm_response_sheet | 56 | 150 | 2025-11-03-S2 |  pages without questions (covers/adverts): [1, 2, 3, 54, 55] |
| Bihar-STET-Class-11-12-Computer-Science-Official-Paper-II-Held-On_-04-Nov-2025-Shift-2-Eng.pdf | ok | digialm_response_sheet | 56 | 150 | 2025-11-04-S2 |  pages without questions (covers/adverts): [1, 2, 3, 54, 55] |
| Bihar-STET-Class-11-12-Computer-Science-Official-Paper-II-Held-On_-07-Nov-2025-Shift-1-Eng.pdf | ok | digialm_response_sheet | 56 | 150 | 2025-11-07-S1 |  pages without questions (covers/adverts): [1, 2, 3, 54, 55] |
| Stet 2023-CS(shift-1)-1.pdf | ok | bseb_question_paper | 35 | 150 | 2023-09-12-S1 |  |
| Stet 2023-CS(shift-2)-1.pdf | ok | bseb_question_paper | 35 | 150 | 2023-09-12-S2 |  |
| Stet 2023-CS(shift-3)-1.pdf | ok | bseb_question_paper | 35 | 150 | 2023-09-18-S3 |  |
| Stet 2024-CS(shift-1).pdf | ok | bseb_sify_response_sheet | 75 | 150 | 2024-06-11-S1 |  |
| Stet 2024-CS(shift-2).pdf | ok | bseb_sify_response_sheet | 74 | 150 | 2024-06-11-S2 |  |
| Stet 2024-CS(shift-3).pdf | ok | bseb_sify_response_sheet | 71 | 150 | 2024-06-12-S1 |  |
| syllabus.jpeg | reference-image | - | - | - | - | Not a question paper. Used as the syllabus/exam-pattern reference (see taxonomy). |

## Paper metadata

| Paper ID | Date | Shift | Shift source | Time | Subject code | Answer key source | Conflicts |
|---|---|---|---|---|---|---|---|
| 2023-09-12-S1 | 2023-09-12 | 1 | Printed in paper header ([SHIFT - n]) | 10:00 AM–12:30 PM | 226 | Answer printed in the source paper ('Right Answer' / 'Right Option Id') | - |
| 2023-09-12-S2 | 2023-09-12 | 2 | Printed in paper header ([SHIFT - n]) | 03:00 PM–05:30 PM | 226 | Answer printed in the source paper ('Right Answer' / 'Right Option Id') | - |
| 2023-09-18-S3 | 2023-09-18 | 3 | Filename (header value was malformed) | 03:00 PM–05:30 PM | 226 | Answer printed in the source paper ('Right Answer' / 'Right Option Id') | header prints shift '31' (apparent typo); shift 3 taken from filename |
| 2024-06-11-S1 | 2024-06-11 | 1 | Annotation added to the PDF by its uploader (not an official field) | 10:00 AM–12:30 PM | 203 | 'Correct Answer' field of the BSEB candidate response sheet (btet.sifyreg.com print-out) | - |
| 2024-06-11-S2 | 2024-06-11 | 2 | Annotation added to the PDF by its uploader (not an official field) | 03:00 PM–05:30 PM | Not available | 'Correct Answer' field of the BSEB candidate response sheet (btet.sifyreg.com print-out) | - |
| 2024-06-12-S1 | 2024-06-12 | 1 | Annotation added to the PDF by its uploader (not an official field) | 10:00 AM–12:30 PM | 213 | 'Correct Answer' field of the BSEB candidate response sheet (btet.sifyreg.com print-out) | filename says shift-3 but the document says shift 1 on 2024-06-12; the document value is used |
| 2025-11-03-S1 | 2025-11-03 | 1 | Cover page added by the republisher (Adda247) | 9:00 AM–11:30 AM | 226 | Option marked correct (green tick) on the response sheet republished by Adda247 | - |
| 2025-11-03-S2 | 2025-11-03 | 2 | Cover page added by the republisher (Adda247) | 2:00 PM–4:30 PM | 226 | Option marked correct (green tick) on the response sheet republished by Adda247 | - |
| 2025-11-04-S2 | 2025-11-04 | 2 | Cover page added by the republisher (Adda247) | 2:00 PM–4:30 PM | 226 | Option marked correct (green tick) on the response sheet republished by Adda247 | - |
| 2025-11-07-S1 | 2025-11-07 | 1 | Cover page added by the republisher (Adda247) | 9:00 AM–11:30 AM | 226 | Option marked correct (green tick) on the response sheet republished by Adda247 | - |

## Validation findings

| Severity | Code | Count |
|---|---|---|
| info | hindi-repaired | 365 |
| info | page-without-text | 16 |
| info | text-transcribed | 7 |
| warning | duplicate-options | 6 |
| warning | extraction-note | 3 |
| warning | metadata-conflict | 2 |
| warning | blank-option | 1 |
| warning | hindi-order | 1 |
| warning | within-paper-duplicate | 1 |

Errors and warnings in full:

- **warning** `duplicate-options` 2025-11-03-S1-Q041: two options have identical text
- **warning** `duplicate-options` 2025-11-04-S2-Q072: two options have identical text
- **warning** `blank-option` 2025-11-07-S1-Q082: option(s) A blank in source
- **warning** `extraction-note` 2025-11-07-S1-Q082: option A is blank in the source PDF
- **warning** `duplicate-options` 2023-09-12-S1-Q022: two options have identical text
- **warning** `duplicate-options` 2023-09-12-S2-Q004: two options have identical text
- **warning** `duplicate-options` 2023-09-12-S2-Q070: two options have identical text
- **warning** `hindi-order` 2024-06-11-S2-Q065: Hindi text still shows visual-order artefacts after repair
- **warning** `duplicate-options` 2024-06-11-S2-Q073: two options have identical text
- **warning** `extraction-note` 2024-06-11-S2-Q149: The options are drawings inside the figure; the source text only says 'Option (A) is Correct' etc. The descriptions here are transcriptions of the drawings.
- **warning** `extraction-note` 2024-06-12-S1-Q149: The source lists options as 'Option (A) is Correct' etc.; the values A) 7 B) 6 C) 4 D) 2 are printed inside the figure.
- **warning** `metadata-conflict` 2023-09-18-S3: header prints shift '31' (apparent typo); shift 3 taken from filename
- **warning** `metadata-conflict` 2024-06-12-S1: filename says shift-3 but the document says shift 1 on 2024-06-12; the document value is used
- **warning** `within-paper-duplicate` : group EX0041 has two copies inside paper(s) ['2025-11-04-S2']