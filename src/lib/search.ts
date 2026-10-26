// Search normalisation. Mirrors pipeline/stet/normalize.py (fold + compact) so that punctuation,
// spacing, quote styles and common Hindi variants (nukta, candrabindu, ZWJ/ZWNJ, danda) do not
// block a match. The displayed text is never altered.
import type { Question } from "../data/types";

const QUOTES: Record<string, string> = {
  "‘": "'", "’": "'", "‛": "'", "“": '"', "”": '"', "`": "'", "´": "'",
  "–": "-", "—": "-", "−": "-", "…": "...", "×": "x",
};
const HI_FOLD: Record<string, string> = {
  "़": "", // nukta
  "ँ": "ं", // candrabindu -> anusvara
  "‌": "",
  "‍": "",
  "।": " ", // danda
  "॥": " ",
};
const FOLD_RE = new RegExp(`[${Object.keys({ ...QUOTES, ...HI_FOLD }).join("")}]`, "g");

export function fold(s: string): string {
  return (s || "")
    .normalize("NFKC")
    .replace(FOLD_RE, (ch) => QUOTES[ch] ?? HI_FOLD[ch] ?? ch)
    .toLowerCase();
}

/** Spacing/punctuation-insensitive form: "full -adder" == "Full adder" == "fulladder". */
export function compact(s: string): string {
  return fold(s).replace(/[\s'"_.,;:?()[\]{}-]+/g, "");
}

export function buildHaystack(q: Question, paperLabel: string): string {
  return compact(
    [
      q.text,
      q.textHi ?? "",
      ...q.options.map((o) => `${o.text} ${o.textHi ?? ""}`),
      q.explanation?.text ?? "",
      q.classification.subject,
      q.classification.topic,
      q.classification.subtopic,
      q.concept ?? "",
      paperLabel,
      q.id,
    ].join(" "),
  );
}

/** Every whitespace-separated term of the query must occur in the haystack. */
export function queryTerms(query: string): string[] {
  return fold(query)
    .split(/\s+/)
    .map(compact)
    .filter(Boolean);
}

export function matchesQuery(haystack: string, terms: string[]): boolean {
  return terms.every((t) => haystack.includes(t));
}
