import type { AnswerStatus, Novelty, RepeatType } from "../data/types";

export const pct = (n: number, d: number, digits = 1) => (d ? `${((100 * n) / d).toFixed(digits)}%` : "–");

export const fmtNum = (n: number) => n.toLocaleString("en-IN");

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "Not available";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export const ANSWER_STATUS: Record<AnswerStatus, { label: string; tone: "good" | "warning" | "critical" | "neutral"; help: string }> = {
  verified: { label: "Key verified", tone: "good", help: "Source key and the independent AI check agree; no conflicting key in other papers." },
  disputed: { label: "Key disputed", tone: "critical", help: "The independent check disagrees with the source key, or the same question is keyed differently in another paper." },
  ambiguous: { label: "Ambiguous question", tone: "warning", help: "AI review flags the question as ambiguous or flawed (e.g. several defensible options)." },
  "source-key-unchecked": { label: "Source key (unchecked)", tone: "neutral", help: "Answer from the key printed in the source PDF; not yet independently checked." },
  unavailable: { label: "No key", tone: "warning", help: "No answer key in the source." },
  "ai-derived-only": { label: "AI-derived only", tone: "warning", help: "No source key; the answer shown is independently derived and unverified." },
};

export const REPEAT_LABEL: Record<RepeatType, string> = {
  exact: "Exact repeat",
  paraphrase: "Paraphrased repeat",
  concept: "Same concept",
  unique: "Not repeated",
};

export const NOVELTY_LABEL: Record<Novelty, string> = {
  "repeat-of-earlier": "Repeat of an earlier paper",
  "new-variation-of-known-concept": "New variation of a known concept",
  "first-appearance": "First appearance",
};

export const DIFFICULTY_LABEL: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard", "not rated": "Not rated" };

export function plural(n: number, one: string, many = one + "s") {
  return `${fmtNum(n)} ${n === 1 ? one : many}`;
}
