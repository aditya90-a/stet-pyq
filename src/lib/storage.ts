// Local persistence (browser localStorage). There is no login/back-end, so progress lives only in
// this browser profile: it is not synced across devices and is lost if site data is cleared.
import { useCallback, useEffect, useState } from "react";
import type { TestResult, TestState } from "./practice";

const KEY = "stet-pyq-lab:v1";

export interface RevisionList {
  id: string;
  name: string;
  ids: string[];
  createdAt: number;
}

export interface Attempt {
  id: string;
  mode: "practice" | "mock";
  finishedAt: number;
  elapsedSec: number;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  scorePct: number;
  questionIds: string[];
  responses: Record<string, number | null>;
  items: TestState["items"];
}

export interface QuestionHistory {
  seen: number;
  correct: number;
  lastCorrect: boolean | null;
  lastAt: number;
}

export interface UserState {
  bookmarks: string[];
  lists: RevisionList[];
  attempts: Attempt[];
  history: Record<string, QuestionHistory>;
  activeTest: TestState | null;
}

const EMPTY: UserState = { bookmarks: [], lists: [], attempts: [], history: {}, activeTest: null };

export function loadState(): UserState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

export function saveState(s: UserState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** Fold a scored test into the per-question history. Pure: returns new state. */
export function recordAttempt(s: UserState, st: TestState, res: TestResult): UserState {
  const now = Date.now();
  const history = { ...s.history };
  for (const r of res.perQuestion) {
    const h = history[r.id] ?? { seen: 0, correct: 0, lastCorrect: null, lastAt: 0 };
    history[r.id] = {
      seen: h.seen + 1,
      correct: h.correct + (r.correct ? 1 : 0),
      lastCorrect: r.correct,
      lastAt: now,
    };
  }
  const attempt: Attempt = {
    id: st.id,
    mode: st.config.mode,
    finishedAt: now,
    elapsedSec: st.elapsedSec,
    total: res.total,
    correct: res.correct,
    wrong: res.wrong,
    unanswered: res.unanswered,
    scorePct: res.scorePct,
    questionIds: st.items.map((i) => i.id),
    responses: st.responses,
    items: st.items,
  };
  return { ...s, history, attempts: [attempt, ...s.attempts].slice(0, 50), activeTest: null };
}

/** Questions whose most recent attempt was wrong or skipped. */
export function needsRevision(s: UserState): string[] {
  return Object.entries(s.history)
    .filter(([, h]) => h.lastCorrect !== true)
    .sort((a, b) => b[1].lastAt - a[1].lastAt)
    .map(([id]) => id);
}

export function useUserState() {
  const [state, setState] = useState<UserState>(loadState);
  const [persistOk, setPersistOk] = useState(true);
  useEffect(() => {
    setPersistOk(saveState(state));
  }, [state]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setState(loadState());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const update = useCallback((fn: (s: UserState) => UserState) => setState((s) => fn(s)), []);
  return { state, update, persistOk };
}

/** Record a single answer given while studying (outside a test). Pure: returns new state. */
export function recordAnswer(s: UserState, id: string, correct: boolean): UserState {
  const h = s.history[id] ?? { seen: 0, correct: 0, lastCorrect: null, lastAt: 0 };
  return { ...s, history: { ...s.history, [id]: { seen: h.seen + 1, correct: h.correct + (correct ? 1 : 0), lastCorrect: correct, lastAt: Date.now() } } };
}

/** Totals across every answer recorded in this browser. */
export function progressSummary(s: UserState) {
  const hs = Object.values(s.history);
  const seen = hs.reduce((a, h) => a + h.seen, 0);
  const correct = hs.reduce((a, h) => a + h.correct, 0);
  return { questions: hs.length, answers: seen, correct, accuracy: seen ? Math.round((100 * correct) / seen) : null, toRevise: needsRevision(s).length, tests: s.attempts.length };
}

export function toggleBookmark(s: UserState, id: string): UserState {
  const has = s.bookmarks.includes(id);
  return { ...s, bookmarks: has ? s.bookmarks.filter((b) => b !== id) : [id, ...s.bookmarks] };
}
