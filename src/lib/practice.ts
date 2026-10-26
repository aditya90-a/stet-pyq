// Practice / mock test engine: selection, shuffling and scoring. Pure functions so they can be unit-tested.
import type { Dataset, Question } from "../data/types";

export interface TestConfig {
  mode: "practice" | "mock";
  subjects: string[];
  topics: string[];
  papers: string[];
  years: string[];
  difficulties: string[];
  count: number;
  minutes: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  onePerFamily: boolean; // avoid asking the same repeated question twice
  excludeDisputed: boolean;
  onlyRepeated: boolean;
  /** practice only: reveal the key and explanation as soon as an option is chosen */
  instant?: boolean;
  questionIds?: string[]; // explicit list (revision of wrong answers, custom lists)
  /** mock "observed pattern": number of questions per section subject */
  sectionQuota?: Record<string, number>;
  seed: number;
}

export interface TestItem {
  id: string;
  order: number[]; // order[displayIndex] = original option index
}

export interface TestState {
  id: string;
  config: TestConfig;
  items: TestItem[];
  responses: Record<string, number | null>; // question id -> original option index
  marked: string[];
  startedAt: number;
  submittedAt: number | null;
  elapsedSec: number;
}

/** Deterministic PRNG so a test can be regenerated from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function eligible(ds: Dataset, c: TestConfig): Question[] {
  if (c.questionIds?.length) return c.questionIds.map((id) => ds.byId.get(id)!).filter(Boolean);
  return ds.questions.filter((q) => {
    const p = ds.paperById.get(q.paperId)!;
    if (q.answer.index === null) return false; // cannot be scored
    if (q.options.some((o) => !o.text.trim()) ) return false; // blank option in source
    if (c.subjects.length && !c.subjects.includes(q.classification.subject)) return false;
    if (c.topics.length && !c.topics.includes(q.classification.topic)) return false;
    if (c.papers.length && !c.papers.includes(q.paperId)) return false;
    if (c.years.length && !c.years.includes(String(p.year))) return false;
    if (c.difficulties.length && !c.difficulties.includes(q.difficulty)) return false;
    if (c.excludeDisputed && (q.answer.status === "disputed" || q.answer.status === "ambiguous")) return false;
    if (c.onlyRepeated && q.repeat.distinctPapers < 2) return false;
    return true;
  });
}

export function buildTest(ds: Dataset, c: TestConfig): TestItem[] {
  const rnd = mulberry32(c.seed);
  let pool = eligible(ds, c);
  if (c.shuffleQuestions || !c.questionIds) pool = shuffle(pool, rnd);
  if (c.onePerFamily) {
    const seen = new Set<string>();
    pool = pool.filter((q) => {
      const fam = q.repeat.repeatGroup ?? q.id;
      if (seen.has(fam)) return false;
      seen.add(fam);
      return true;
    });
  }
  let chosen: Question[];
  if (c.sectionQuota) {
    chosen = [];
    for (const [sec, n] of Object.entries(c.sectionQuota)) chosen.push(...pool.filter((q) => q.sectionSubject === sec).slice(0, n));
  } else {
    chosen = pool.slice(0, c.count);
  }
  if (!c.shuffleQuestions) {
    const order = new Map(ds.papers.map((p, i) => [p.id, i]));
    chosen.sort((a, b) => order.get(a.paperId)! - order.get(b.paperId)! || a.qno - b.qno);
  }
  return chosen.map((q) => {
    const idx = q.options.map((_, i) => i);
    return { id: q.id, order: c.shuffleOptions ? shuffle(idx, rnd) : idx };
  });
}

export interface TopicScore {
  topic: string;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
}

export interface TestResult {
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
  scorePct: number;
  accuracyPct: number;
  byTopic: TopicScore[];
  perQuestion: { id: string; chosen: number | null; key: number; correct: boolean | null }[];
}

/** Scores against the answer key printed in the source PDF (no negative marking). */
export function scoreTest(ds: Dataset, st: Pick<TestState, "items" | "responses">): TestResult {
  const per = st.items.map(({ id }) => {
    const q = ds.byId.get(id)!;
    const chosen = st.responses[id] ?? null;
    const key = q.answer.index!;
    return { id, chosen, key, correct: chosen === null ? null : chosen === key };
  });
  const topics = new Map<string, TopicScore>();
  for (const r of per) {
    const t = ds.byId.get(r.id)!.classification.topic;
    const s = topics.get(t) ?? { topic: t, total: 0, correct: 0, wrong: 0, unanswered: 0 };
    s.total++;
    if (r.correct === null) s.unanswered++;
    else if (r.correct) s.correct++;
    else s.wrong++;
    topics.set(t, s);
  }
  const correct = per.filter((r) => r.correct === true).length;
  const wrong = per.filter((r) => r.correct === false).length;
  const attempted = correct + wrong;
  return {
    total: per.length,
    attempted,
    correct,
    wrong,
    unanswered: per.length - attempted,
    scorePct: per.length ? Math.round((1000 * correct) / per.length) / 10 : 0,
    accuracyPct: attempted ? Math.round((1000 * correct) / attempted) / 10 : 0,
    byTopic: [...topics.values()].sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total),
    perQuestion: per,
  };
}

export function defaultConfig(mode: TestConfig["mode"] = "practice"): TestConfig {
  return {
    mode,
    subjects: [],
    topics: [],
    papers: [],
    years: [],
    difficulties: [],
    count: 20,
    minutes: mode === "mock" ? 150 : 20,
    shuffleQuestions: true,
    shuffleOptions: false,
    onePerFamily: true,
    excludeDisputed: true,
    onlyRepeated: false,
    instant: mode === "practice",
    seed: Date.now() % 2147483647,
  };
}
