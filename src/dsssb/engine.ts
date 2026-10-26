// Mock-test engine for the DSSSB section: selection, shuffling and scoring with negative marking.
// Pure functions so they can be unit-tested.
import { mulberry32, shuffle } from "../lib/practice";
import type { DDataset, DQuestion } from "./types";

export interface TestConfig {
  kind: "full" | "sectional" | "topic" | "paper" | "quick" | "custom" | "incorrect";
  title: string;
  subjects: string[];
  topics: string[];
  papers: string[];
  difficulties: string[];
  count: number;
  minutes: number | null;
  /** marks deducted per wrong answer (DSSSB: 0.25 for a 1-mark question) */
  negative: number;
  includeDisputed: boolean;
  doeOnly: boolean;
  /** subject -> number of questions (full mock follows the exam pattern) */
  quota?: Record<string, number>;
  questionIds?: string[];
  instant: boolean;
  shuffle: boolean;
  seed: number;
}

export interface TestItem {
  id: string;
}

export interface TestState {
  id: string;
  config: TestConfig;
  items: TestItem[];
  responses: Record<string, number | null>;
  marked: string[];
  current: number;
  startedAt: number;
  elapsedSec: number;
}

export const NEGATIVE = 0.25;

/** A question can be scored only if it has exactly one key (or several accepted keys) and is not dropped. */
export function scorable(q: DQuestion): boolean {
  return q.answer.status === "keyed" || q.answer.status === "multiple";
}

export function eligible(ds: DDataset, c: TestConfig): DQuestion[] {
  if (c.questionIds?.length) return c.questionIds.map((id) => ds.byId.get(id)).filter((q): q is DQuestion => !!q && scorable(q));
  return ds.questions.filter((q) => {
    if (!scorable(q)) return false;
    if (!c.includeDisputed && q.verification.status === "disputed") return false;
    if (c.doeOnly && ds.paperById.get(q.paperId)?.departmentShort !== "DoE") return false;
    if (c.subjects.length && !c.subjects.includes(q.classification.subject)) return false;
    if (c.topics.length && !c.topics.includes(`${q.classification.subject}|${q.classification.topic}`)) return false;
    if (c.papers.length && !c.papers.includes(q.paperId)) return false;
    if (c.difficulties.length && !c.difficulties.includes(q.difficulty)) return false;
    return true;
  });
}

const SUBJECT_ORDER = ["General Awareness", "General Intelligence & Reasoning", "Arithmetical & Numerical Ability", "Hindi Language", "English Language", "Computer Science", "Teaching Methodology"];

export function buildTest(ds: DDataset, c: TestConfig): TestItem[] {
  const rnd = mulberry32(c.seed);
  let pool = eligible(ds, c);
  if (c.kind === "paper") {
    pool.sort((a, b) => a.qno - b.qno);
    return pool.map((q) => ({ id: q.id }));
  }
  if (c.shuffle) pool = shuffle(pool, rnd);
  let chosen: DQuestion[];
  if (c.quota) {
    chosen = [];
    for (const s of SUBJECT_ORDER) {
      const n = c.quota[s];
      if (n) chosen.push(...pool.filter((q) => q.classification.subject === s).slice(0, n));
    }
  } else {
    chosen = pool.slice(0, c.count);
  }
  // keep comprehension questions next to each other and sections in paper order
  if (c.kind === "full" || c.kind === "sectional") {
    chosen.sort((a, b) => SUBJECT_ORDER.indexOf(a.classification.subject) - SUBJECT_ORDER.indexOf(b.classification.subject) || (a.passage ?? "").localeCompare(b.passage ?? ""));
  }
  return chosen.map((q) => ({ id: q.id }));
}

/** Section quotas for a full mock: Section A 5 × 20, Section B 100 split between CS and teaching methodology
 *  in the proportion observed in the DoE papers. */
export function fullMockQuota(ds: DDataset): Record<string, number> {
  const doe = ds.papers.filter((p) => p.departmentShort === "DoE");
  const tm = doe.reduce((a, p) => a + (p.stats.bySubject["Teaching Methodology"] ?? 0), 0) / Math.max(1, doe.length);
  const tmN = Math.round(tm);
  return {
    "General Awareness": 20,
    "General Intelligence & Reasoning": 20,
    "Arithmetical & Numerical Ability": 20,
    "Hindi Language": 20,
    "English Language": 20,
    "Computer Science": 100 - tmN,
    "Teaching Methodology": tmN,
  };
}

export interface SectionScore {
  name: string;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  marks: number;
}

export interface TestResult {
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
  marks: number;
  maxMarks: number;
  accuracyPct: number;
  bySubject: SectionScore[];
  byTopic: SectionScore[];
  perQuestion: { id: string; chosen: number | null; correct: boolean | null }[];
}

export function isCorrect(q: DQuestion, chosen: number) {
  return q.answer.indices.includes(chosen);
}

export function scoreTest(ds: DDataset, st: Pick<TestState, "items" | "responses">, negative = NEGATIVE): TestResult {
  const per = st.items.map(({ id }) => {
    const q = ds.byId.get(id)!;
    const chosen = st.responses[id] ?? null;
    return { id, chosen, correct: chosen === null ? null : isCorrect(q, chosen) };
  });
  const group = (key: (q: DQuestion) => string) => {
    const m = new Map<string, SectionScore>();
    for (const r of per) {
      const k = key(ds.byId.get(r.id)!);
      const s = m.get(k) ?? { name: k, total: 0, correct: 0, wrong: 0, unanswered: 0, marks: 0 };
      s.total++;
      if (r.correct === null) s.unanswered++;
      else if (r.correct) {
        s.correct++;
        s.marks += 1;
      } else {
        s.wrong++;
        s.marks -= negative;
      }
      m.set(k, s);
    }
    return [...m.values()];
  };
  const correct = per.filter((r) => r.correct === true).length;
  const wrong = per.filter((r) => r.correct === false).length;
  const attempted = correct + wrong;
  return {
    total: per.length,
    attempted,
    correct,
    wrong,
    unanswered: per.length - attempted,
    marks: Math.round((correct - wrong * negative) * 100) / 100,
    maxMarks: per.length,
    accuracyPct: attempted ? Math.round((1000 * correct) / attempted) / 10 : 0,
    bySubject: group((q) => q.classification.subject).sort((a, b) => SUBJECT_ORDER.indexOf(a.name) - SUBJECT_ORDER.indexOf(b.name)),
    byTopic: group((q) => q.classification.topic).sort((a, b) => a.marks / a.total - b.marks / b.total),
    perQuestion: per,
  };
}

export function baseConfig(kind: TestConfig["kind"], title: string): TestConfig {
  return {
    kind,
    title,
    subjects: [],
    topics: [],
    papers: [],
    difficulties: [],
    count: 25,
    minutes: 30,
    negative: NEGATIVE,
    includeDisputed: false,
    doeOnly: false,
    instant: false,
    shuffle: true,
    seed: Date.now() % 2147483647,
  };
}
