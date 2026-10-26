// DSSSB section: integrity checks on the generated dataset (public/dsssb/data) and unit tests of the
// mock-test engine, progress state and recommendations.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { baseConfig, buildTest, eligible, fullMockQuota, scorable, scoreTest } from "../src/dsssb/engine";
import { streak, topicInsights } from "../src/dsssb/insights";
import { EMPTY, gradeCard, incorrectIds, isDue, recordAnswer, toggleBookmark } from "../src/dsssb/state";
import { indexDataset } from "../src/dsssb/store";
import type { DDataset } from "../src/dsssb/types";

const dir = resolve(__dirname, "../public/dsssb/data");
const ready = existsSync(resolve(dir, "questions.json"));
const load = (n: string) => JSON.parse(readFileSync(resolve(dir, `${n}.json`), "utf8"));

const ds: DDataset = ready
  ? indexDataset({
      questions: load("questions"), papers: load("papers"), groups: load("groups"), stats: load("stats"), meta: load("meta"),
      exam: load("exam"), verification: load("verification"), library: load("library"), notes: load("notes/index"),
    })
  : ({} as DDataset);

describe.skipIf(!ready)("DSSSB dataset", () => {
  it("has 200 questions in every paper, numbered 1..200", () => {
    for (const p of ds.papers) {
      const qs = ds.questions.filter((q) => q.paperId === p.id);
      expect(qs.length).toBe(200);
      expect(new Set(qs.map((q) => q.qno)).size).toBe(200);
      expect(p.numbering.gaps).toEqual([]);
    }
  });

  it("every question cites a page inside its source PDF and every image file exists", () => {
    for (const q of ds.questions) {
      const p = ds.paperById.get(q.paperId)!;
      expect(q.source.pdf).toBe(p.pdf.name);
      expect(q.source.page).toBeGreaterThanOrEqual(1);
      expect(q.source.pageEnd).toBeLessThanOrEqual(p.pdf.pages);
      const files = [...q.images, ...q.imagesHi, ...q.passageImages, ...q.options.flatMap((o) => [...o.images, ...o.imagesHi])];
      for (const f of files) expect(existsSync(resolve(__dirname, "../public", f)), f).toBe(true);
    }
  });

  it("keys are never invented: a key exists only where the source marked one, dropped questions have none", () => {
    for (const q of ds.questions) {
      if (q.answer.status === "dropped") {
        expect(q.answer.indices).toEqual([]);
        expect(q.answer.officialNote).toMatch(/ignored for all candidates/);
      } else {
        expect(q.answer.indices.length).toBe(1);
        expect(q.answer.label).toBe("ABCD"[q.answer.indices[0]]);
      }
    }
  });

  it("verification labels are honest", () => {
    for (const q of ds.questions) {
      const v = q.verification;
      const fails = v.checks.filter((c) => c.result === "fail").map((c) => c.id);
      if (v.status === "verified") {
        expect(fails).toEqual([]);
        expect(v.corrections).toEqual([]);
        if (q.answer.status !== "dropped") expect(q.aiCheck?.derivedIndex).toBe(q.answer.indices[0]);
      }
      if (v.status === "corrected") {
        expect(v.corrections.length).toBeGreaterThan(0);
        for (const c of v.corrections) expect(c.evidence.page).toBeGreaterThan(0);
      }
      if (v.status === "disputed") expect(fails.some((f) => ["ai-answer", "cross-paper", "key-image", "key-bilingual"].includes(f))).toBe(true);
      // corrections never touch the answer key
      for (const c of v.corrections) expect(c.field).not.toMatch(/answer|key/i);
    }
  });

  it("dashboard totals match the questions actually present", () => {
    const t = ds.stats.totals;
    expect(t.questions).toBe(ds.questions.length);
    expect(t.papers).toBe(ds.papers.length);
    const byStatus = ds.questions.reduce<Record<string, number>>((a, q) => ((a[q.verification.status] = (a[q.verification.status] ?? 0) + 1), a), {});
    expect(ds.stats.byStatus).toEqual(byStatus);
    expect(ds.verification.open.length).toBe((byStatus.disputed ?? 0) + (byStatus.unverified ?? 0));
    const topicSum = ds.stats.topics.reduce((a, r) => a + r.questions, 0);
    expect(topicSum).toBe(ds.questions.length);
  });

  it("classifications use the taxonomy", () => {
    for (const q of ds.questions) {
      const c = q.classification;
      expect(ds.meta.taxonomy[c.subject], c.subject).toBeTruthy();
      expect(ds.meta.taxonomy[c.subject].topics[c.topic], `${q.id} ${c.topic}`).toBeTruthy();
      expect(ds.meta.taxonomy[c.subject].topics[c.topic].subtopics).toContain(c.subtopic);
    }
  });

  it("repeat groups only join questions with the same key text", () => {
    for (const g of ds.groups.repeat) {
      const keyed = g.members.map((m) => ds.byId.get(m)!).filter((q) => q.answer.indices.length === 1);
      for (const q of keyed) expect(q.answer.crossPaper).not.toBe("conflict");
    }
  });

  it("the 2024 paper is labelled as NDMC (70/23), not the DoE post", () => {
    const p = ds.paperById.get("2024-02-07-s2")!;
    expect(p.postCode).toBe("70/23");
    expect(p.departmentShort).toBe("NDMC");
  });

  it("official syllabus lists 32 CS units and 10 pedagogy units", () => {
    expect(ds.exam.syllabus.csUnits.length).toBe(32);
    expect(ds.exam.syllabus.pedagogyUnits.length).toBe(10);
  });

  it("full mock follows the exam pattern: 200 questions, 100 in Section A", () => {
    const quota = fullMockQuota(ds);
    expect(Object.values(quota).reduce((a, b) => a + b, 0)).toBe(200);
    const items = buildTest(ds, { ...baseConfig("full", "t"), quota, seed: 7 });
    expect(items.length).toBe(200);
    const partA = items.filter((i) => ds.meta.taxonomy[ds.byId.get(i.id)!.classification.subject].part === "A").length;
    expect(partA).toBe(100);
    for (const i of items) expect(scorable(ds.byId.get(i.id)!)).toBe(true);
  });

  it("disputed questions are left out unless asked for", () => {
    const c = { ...baseConfig("quick", "t"), count: 2000 };
    expect(eligible(ds, c).some((q) => q.verification.status === "disputed")).toBe(false);
    expect(eligible(ds, { ...c, includeDisputed: true }).some((q) => q.verification.status === "disputed")).toBe(true);
  });

  it("scores +1 / −0.25 per question", () => {
    const items = buildTest(ds, { ...baseConfig("quick", "t"), count: 4, seed: 3 });
    const [a, b, c] = items.map((i) => ds.byId.get(i.id)!);
    const wrong = (q: typeof a) => [0, 1, 2, 3].find((k) => !q.answer.indices.includes(k))!;
    const res = scoreTest(ds, { items, responses: { [a.id]: a.answer.indices[0], [b.id]: wrong(b), [c.id]: wrong(c) } });
    expect(res.correct).toBe(1);
    expect(res.wrong).toBe(2);
    expect(res.unanswered).toBe(1);
    expect(res.marks).toBe(0.5);
  });

  it("recommendations rank by weightage and accuracy", () => {
    const ins = topicInsights(ds, EMPTY);
    expect(ins.length).toBeGreaterThan(10);
    for (let i = 1; i < ins.length; i++) expect(ins[i - 1].priority).toBeGreaterThanOrEqual(ins[i].priority);
  });
});

describe("progress state", () => {
  it("records answers, the daily log and wrong answers", () => {
    let s = recordAnswer(EMPTY, "q1", false, new Date("2026-11-01T10:00:00").getTime());
    s = recordAnswer(s, "q2", true, new Date("2026-11-01T11:00:00").getTime());
    expect(incorrectIds(s)).toEqual(["q1"]);
    expect(s.planner.log["2026-11-01"]).toBe(2);
    s = recordAnswer(s, "q1", true);
    expect(incorrectIds(s)).toEqual([]);
  });

  it("toggles bookmarks", () => {
    const s = toggleBookmark(EMPTY, "x");
    expect(s.bookmarks).toEqual(["x"]);
    expect(toggleBookmark(s, "x").bookmarks).toEqual([]);
  });

  it("moves flashcards through Leitner boxes", () => {
    const now = 1_000_000;
    let s = gradeCard(EMPTY, "c", true, now);
    expect(s.cards.c.box).toBe(1);
    expect(isDue(s.cards.c, now)).toBe(false);
    expect(isDue(s.cards.c, now + 86400000)).toBe(true);
    s = gradeCard(s, "c", false, now);
    expect(s.cards.c.box).toBe(0);
  });

  it("counts a goal streak", () => {
    const log = { "2026-11-01": 30, "2026-11-02": 31, "2026-11-03": 5 };
    expect(streak(log, 30, new Date("2026-11-03T12:00:00"))).toBe(2);
    expect(streak(log, 30, new Date("2026-11-05T12:00:00"))).toBe(0);
  });
});
