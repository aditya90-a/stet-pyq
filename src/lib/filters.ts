import type { Dataset, Question } from "../data/types";
import { matchesQuery, queryTerms } from "./search";

export interface QuestionFilter {
  q?: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  paper?: string;
  year?: string;
  date?: string;
  shift?: string;
  qtype?: string;
  difficulty?: string;
  repeat?: string; // exact | paraphrase | concept | unique | repeated (any family across >=2 papers)
  answer?: string; // AnswerStatus or "any-verified"
  pdf?: string;
  bookmarked?: string;
  novelty?: string;
}

export const FILTER_KEYS: (keyof QuestionFilter)[] = [
  "q", "subject", "topic", "subtopic", "paper", "year", "date", "shift", "qtype", "difficulty", "repeat", "answer", "pdf", "bookmarked", "novelty",
];

export function filterQuestions(ds: Dataset, f: QuestionFilter, bookmarks?: Set<string>): Question[] {
  const terms = f.q ? queryTerms(f.q) : [];
  return ds.questions.filter((q) => {
    const p = ds.paperById.get(q.paperId)!;
    if (f.subject && q.classification.subject !== f.subject) return false;
    if (f.topic && q.classification.topic !== f.topic) return false;
    if (f.subtopic && q.classification.subtopic !== f.subtopic) return false;
    if (f.paper && q.paperId !== f.paper) return false;
    if (f.year && String(p.year) !== f.year) return false;
    if (f.date && p.date !== f.date) return false;
    if (f.shift && String(p.shift) !== f.shift) return false;
    if (f.qtype && q.qtype !== f.qtype) return false;
    if (f.difficulty && q.difficulty !== f.difficulty) return false;
    if (f.pdf && q.source.pdf !== f.pdf) return false;
    if (f.repeat) {
      if (f.repeat === "repeated") {
        if (q.repeat.distinctPapers < 2) return false;
      } else if (q.repeat.type !== f.repeat) return false;
    }
    if (f.answer) {
      if (f.answer === "unverified") {
        if (q.answer.status === "verified") return false;
      } else if (q.answer.status !== f.answer) return false;
    }
    if (f.novelty && q.repeat.novelty !== f.novelty) return false;
    if (f.bookmarked === "1" && !bookmarks?.has(q.id)) return false;
    if (terms.length && !matchesQuery(ds.haystack.get(q.id) ?? "", terms)) return false;
    return true;
  });
}

export type SortKey = "paper" | "repeats" | "difficulty" | "topic" | "recent";

const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2, "not rated": 3 };

export function sortQuestions(ds: Dataset, qs: Question[], key: SortKey): Question[] {
  const order = new Map(ds.papers.map((p, i) => [p.id, i]));
  const byPaper = (a: Question, b: Question) => order.get(a.paperId)! - order.get(b.paperId)! || a.qno - b.qno;
  const out = [...qs];
  switch (key) {
    case "repeats":
      return out.sort((a, b) => b.repeat.distinctPapers - a.repeat.distinctPapers || (a.repeat.repeatGroup ?? "").localeCompare(b.repeat.repeatGroup ?? "") || byPaper(a, b));
    case "difficulty":
      return out.sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty] || byPaper(a, b));
    case "topic":
      return out.sort((a, b) => a.classification.topic.localeCompare(b.classification.topic) || a.classification.subtopic.localeCompare(b.classification.subtopic) || byPaper(a, b));
    case "recent":
      return out.sort((a, b) => -byPaper(a, b));
    default:
      return out.sort(byPaper);
  }
}

export function paginate<T>(items: T[], page: number, size: number): { items: T[]; pages: number; page: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: items.slice((p - 1) * size, p * size), pages, page: p };
}

/** Count helper that always returns entries sorted by descending count. */
export function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
