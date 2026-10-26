// Integrity checks on the real generated dataset (public/data). Skipped if the pipeline has not run.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { indexDataset } from "../src/data/store";
import type { Dataset } from "../src/data/types";
import { filterQuestions } from "../src/lib/filters";

const dir = resolve(__dirname, "../public/data");
const ready = existsSync(resolve(dir, "questions.json"));
const load = (n: string) => JSON.parse(readFileSync(resolve(dir, `${n}.json`), "utf8"));

describe.skipIf(!ready)("generated dataset", () => {
  const ds: Dataset = ready
    ? indexDataset({ questions: load("questions"), papers: load("papers"), groups: load("groups"), stats: load("stats"), meta: load("meta") })
    : ({} as Dataset);

  it("dashboard totals match the questions actually present", () => {
    const t = ds.stats.totals;
    expect(t.questions).toBe(ds.questions.length);
    expect(t.papers).toBe(ds.papers.length);
    expect(t.repeatGroups).toBe(ds.groups.repeat.filter((g) => g.distinctPapers > 1).length);
    for (const p of ds.papers) expect(ds.stats.papers[p.id].questions).toBe(ds.questions.filter((q) => q.paperId === p.id).length);
  });

  it("every question cites a page inside its source PDF", () => {
    for (const q of ds.questions) {
      const p = ds.paperById.get(q.paperId)!;
      expect(q.source.pdfUrl).toBe(p.pdf.url);
      expect(q.source.page).toBeGreaterThanOrEqual(1);
      expect(q.source.pageEnd).toBeLessThanOrEqual(p.pdf.pages);
    }
    for (const q of ds.questions) for (const f of q.figures) expect(existsSync(resolve(__dirname, "../public", f.file))).toBe(true);
  });

  it("answer labels are honest: verified implies the AI check matched the source key", () => {
    for (const q of ds.questions) {
      if (q.answer.status === "verified") expect(q.aiCheck?.derivedIndex).toBe(q.answer.index);
      if (q.answer.status === "disputed") expect(q.aiCheck?.derivedIndex !== q.answer.index || q.answer.crossPaper === "conflict").toBe(true);
      if (q.explanation) expect(q.explanation.origin).toBe("ai-generated");
    }
  });

  it("repeat families never count a paper twice and match links are symmetric", () => {
    for (const g of ds.groups.repeat) expect(g.distinctPapers).toBe(new Set(g.members.map((m) => ds.byId.get(m)!.paperId)).size);
    for (const q of ds.questions)
      for (const m of q.repeat.matches.filter((x) => x.type === "exact")) expect(ds.byId.get(m.id)!.repeat.exactGroup).toBe(q.repeat.exactGroup);
  });

  it("published data carries no local file paths", () => {
    expect(JSON.stringify(ds.meta)).not.toMatch(/\/Users\//);
    expect(existsSync(resolve(dir, "quality.json"))).toBe(false);
  });

  it("Hindi search finds bilingual questions", () => {
    const hits = filterQuestions(ds, { q: "फ्लिप-फ्लॉप" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((q) => (q.textHi ?? "") + q.options.map((o) => o.textHi ?? "").join("") !== "")).toBe(true);
  });
});
