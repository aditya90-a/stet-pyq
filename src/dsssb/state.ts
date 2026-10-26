// Progress for the DSSSB section, stored in this browser only (localStorage). Nothing is uploaded.
import { useCallback, useEffect, useState } from "react";
import type { TestState } from "./engine";

const KEY = "dsssb-tgt-cs:v1";

export interface QHist {
  seen: number;
  correct: number;
  lastCorrect: boolean | null;
  lastAt: number;
}

export interface Attempt {
  id: string;
  title: string;
  kind: string;
  finishedAt: number;
  elapsedSec: number;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  marks: number;
  maxMarks: number;
  negative: number;
  responses: Record<string, number | null>;
  items: TestState["items"];
}

/** Leitner box for a flashcard: due timestamp and box 0-5. */
export interface Card {
  box: number;
  due: number;
  seen: number;
}

export interface Task {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  done: boolean;
  link?: string;
}

export interface UserState {
  bookmarks: string[];
  history: Record<string, QHist>;
  attempts: Attempt[];
  activeTest: TestState | null;
  cards: Record<string, Card>;
  syllabusDone: Record<string, number>; // "subject|topic|subtopic" -> time marked done
  notesRead: Record<string, number>;
  topicReviews: Record<string, { stage: number; last: number }>; // "subject|topic" -> spaced revision stage
  planner: { dailyGoal: number; tasks: Task[]; log: Record<string, number> }; // log: date -> questions answered
}

export const EMPTY: UserState = {
  bookmarks: [],
  history: {},
  attempts: [],
  activeTest: null,
  cards: {},
  syllabusDone: {},
  notesRead: {},
  topicReviews: {},
  planner: { dailyGoal: 30, tasks: [], log: {} },
};

export function loadState(): UserState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const p = JSON.parse(raw);
    return { ...structuredClone(EMPTY), ...p, planner: { ...EMPTY.planner, ...(p.planner ?? {}) } };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function useUserState() {
  const [state, setState] = useState<UserState>(loadState);
  const [persistOk, setPersistOk] = useState(true);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      setPersistOk(true);
    } catch {
      setPersistOk(false);
    }
  }, [state]);
  useEffect(() => {
    const on = (e: StorageEvent) => e.key === KEY && setState(loadState());
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);
  const update = useCallback((fn: (s: UserState) => UserState) => setState((s) => fn(s)), []);
  return { state, update, persistOk };
}

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function recordAnswer(s: UserState, id: string, correct: boolean, now = Date.now()): UserState {
  const h = s.history[id] ?? { seen: 0, correct: 0, lastCorrect: null, lastAt: 0 };
  const d = today(new Date(now));
  return {
    ...s,
    history: { ...s.history, [id]: { seen: h.seen + 1, correct: h.correct + (correct ? 1 : 0), lastCorrect: correct, lastAt: now } },
    planner: { ...s.planner, log: { ...s.planner.log, [d]: (s.planner.log[d] ?? 0) + 1 } },
  };
}

export function toggleBookmark(s: UserState, id: string): UserState {
  return { ...s, bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter((b) => b !== id) : [id, ...s.bookmarks] };
}

/** Questions whose latest attempt was wrong, newest first. */
export function incorrectIds(s: UserState): string[] {
  return Object.entries(s.history)
    .filter(([, h]) => h.lastCorrect === false)
    .sort((a, b) => b[1].lastAt - a[1].lastAt)
    .map(([id]) => id);
}

// Leitner intervals in days for boxes 0..5
export const BOX_DAYS = [0, 1, 3, 7, 15, 30];

export function gradeCard(s: UserState, id: string, knew: boolean, now = Date.now()): UserState {
  const c = s.cards[id] ?? { box: 0, due: 0, seen: 0 };
  const box = knew ? Math.min(5, c.box + 1) : 0;
  return { ...s, cards: { ...s.cards, [id]: { box, due: now + BOX_DAYS[box] * 86400000, seen: c.seen + 1 } } };
}

export const isDue = (c: Card | undefined, now = Date.now()) => !c || c.due <= now;

// spaced revision of whole topics: revisit after 1, 3, 7, 15 and 30 days
export const REVIEW_DAYS = [1, 3, 7, 15, 30];

export function studyTopic(s: UserState, key: string, now = Date.now()): UserState {
  const r = s.topicReviews[key];
  const stage = r ? Math.min(REVIEW_DAYS.length - 1, r.stage + 1) : 0;
  return { ...s, topicReviews: { ...s.topicReviews, [key]: { stage, last: now } } };
}

export function reviewDue(r: { stage: number; last: number }, now = Date.now()) {
  return r.last + REVIEW_DAYS[r.stage] * 86400000 <= now;
}

export function accuracyByTopic(s: UserState, topicOf: (id: string) => string | undefined) {
  const out = new Map<string, { seen: number; correct: number }>();
  for (const [id, h] of Object.entries(s.history)) {
    const t = topicOf(id);
    if (!t) continue;
    const a = out.get(t) ?? { seen: 0, correct: 0 };
    a.seen += h.seen;
    a.correct += h.correct;
    out.set(t, a);
  }
  return out;
}
