import { describe, expect, it } from "vitest";
import { filterQuestions, paginate, sortQuestions } from "../src/lib/filters";
import { buildTest, defaultConfig, eligible, mulberry32, scoreTest } from "../src/lib/practice";
import { compact, fold, matchesQuery, queryTerms } from "../src/lib/search";
import { needsRevision, progressSummary, recordAnswer, recordAttempt, toggleBookmark, type UserState } from "../src/lib/storage";
import { sample } from "./fixtures";

describe("search normalisation", () => {
  it("ignores punctuation, spacing and case", () => {
    expect(compact("Full -adder")).toBe(compact("full adder"));
    expect(compact("e-mails?")).toBe(compact("E mails"));
  });
  it("folds Hindi nukta, candrabindu and zero-width joiners", () => {
    expect(compact("फ़ुल")).toBe(compact("फुल"));
    expect(fold("हँसी")).toBe(fold("हंसी"));
    expect(compact("क‍ष")).toBe(compact("कष"));
  });
  it("requires every query term", () => {
    const h = compact("Which protocol is used for sending e-mails? SMTP");
    expect(matchesQuery(h, queryTerms("smtp emails"))).toBe(true);
    expect(matchesQuery(h, queryTerms("smtp ftp"))).toBe(false);
  });
});

describe("question filters, sorting and pagination", () => {
  const { ds, qs, p2 } = sample();
  it("filters by paper, subject, difficulty and answer status", () => {
    expect(filterQuestions(ds, { paper: p2.id }).length).toBe(3);
    expect(filterQuestions(ds, { subject: "Art of Teaching" }).map((q) => q.id)).toEqual([qs[4].id]);
    expect(filterQuestions(ds, { difficulty: "hard" }).length).toBe(1);
    expect(filterQuestions(ds, { answer: "disputed" }).length).toBe(1);
    expect(filterQuestions(ds, { answer: "unverified" }).length).toBe(1);
    expect(filterQuestions(ds, { repeat: "repeated" }).length).toBe(2);
    expect(filterQuestions(ds, { novelty: "repeat-of-earlier" }).map((q) => q.id)).toEqual([qs[1].id]);
  });
  it("searches English and Hindi text", () => {
    expect(filterQuestions(ds, { q: "full adder" }).length).toBe(1);
    expect(filterQuestions(ds, { q: "फुल एडर" }).length).toBe(1); // typed without nukta
    expect(filterQuestions(ds, { q: "Application Layer" }).length).toBe(2); // topic is searchable
  });
  it("filters bookmarks", () => {
    expect(filterQuestions(ds, { bookmarked: "1" }, new Set([qs[2].id])).map((q) => q.id)).toEqual([qs[2].id]);
  });
  it("sorts by repetition and paginates", () => {
    const s = sortQuestions(ds, ds.questions, "repeats");
    expect(s[0].repeat.distinctPapers).toBe(2);
    const pg = paginate(ds.questions, 9, 2);
    expect(pg.page).toBe(3);
    expect(pg.pages).toBe(3);
    expect(pg.items.length).toBe(1);
  });
});

describe("practice tests", () => {
  const { ds, qs } = sample();
  it("is deterministic for a seed and asks a repeated family only once", () => {
    const c = { ...defaultConfig(), count: 10, onePerFamily: true, excludeDisputed: false, seed: 42 };
    const a = buildTest(ds, c);
    const b = buildTest(ds, c);
    expect(a).toEqual(b);
    const fam = a.filter((i) => i.id === qs[0].id || i.id === qs[1].id);
    expect(fam.length).toBe(1);
    expect(a.length).toBe(4);
  });
  it("excludes disputed keys when asked", () => {
    expect(eligible(ds, { ...defaultConfig(), excludeDisputed: true }).some((q) => q.answer.status === "disputed")).toBe(false);
  });
  it("shuffled options keep a valid permutation", () => {
    const t = buildTest(ds, { ...defaultConfig(), shuffleOptions: true, seed: 7, onePerFamily: false, excludeDisputed: false });
    for (const it of t) expect([...it.order].sort()).toEqual([0, 1, 2, 3]);
  });
  it("scores against the source key and reports topics", () => {
    const items = buildTest(ds, { ...defaultConfig(), count: 5, onePerFamily: false, excludeDisputed: false, seed: 1 });
    const responses: Record<string, number | null> = {};
    items.forEach((i, k) => (responses[i.id] = k === 0 ? ds.byId.get(i.id)!.answer.index : k === 1 ? 3 : null));
    const r = scoreTest(ds, { items, responses });
    expect(r.correct).toBe(1);
    expect(r.wrong).toBe(1);
    expect(r.unanswered).toBe(3);
    expect(r.scorePct).toBe(20);
    expect(r.accuracyPct).toBe(50);
    expect(r.byTopic.reduce((a, t) => a + t.total, 0)).toBe(5);
  });
  it("prng is in [0,1)", () => {
    const rnd = mulberry32(3);
    for (let i = 0; i < 100; i++) {
      const v = rnd();
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
});

describe("local progress", () => {
  const { ds, qs } = sample();
  const empty: UserState = { bookmarks: [], lists: [], attempts: [], history: {}, activeTest: null };
  it("toggles bookmarks", () => {
    const s = toggleBookmark(toggleBookmark(empty, qs[0].id), qs[1].id);
    expect(s.bookmarks).toEqual([qs[1].id, qs[0].id]);
    expect(toggleBookmark(s, qs[0].id).bookmarks).toEqual([qs[1].id]);
  });
  it("records attempts and lists questions needing revision", () => {
    const items = [qs[0], qs[2]].map((q) => ({ id: q.id, order: [0, 1, 2, 3] }));
    const st = { id: "T1", config: defaultConfig(), items, responses: { [qs[0].id]: 0, [qs[2].id]: 2 }, marked: [], startedAt: 0, submittedAt: 1, elapsedSec: 60 };
    const s = recordAttempt(empty, st, scoreTest(ds, st));
    expect(s.attempts[0].correct).toBe(1);
    expect(needsRevision(s)).toEqual([qs[2].id]);
  });
  it("records single study answers and summarises progress", () => {
    let s = recordAnswer(empty, qs[0].id, false);
    expect(needsRevision(s)).toEqual([qs[0].id]);
    s = recordAnswer(s, qs[0].id, true);
    s = recordAnswer(s, qs[1].id, true);
    expect(needsRevision(s)).toEqual([]);
    expect(progressSummary(s)).toEqual({ questions: 2, answers: 3, correct: 2, accuracy: 67, toRevise: 0, tests: 0 });
    expect(progressSummary(empty).accuracy).toBeNull();
  });
});
