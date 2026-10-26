// Study recommendations from historical weightage and the learner's own record. Pure functions (tested).
import type { UserState } from "./state";
import type { DDataset } from "./types";

export interface TopicInsight {
  key: string; // "subject|topic"
  subject: string;
  topic: string;
  weight: number; // average questions per DoE paper (all papers if the topic never appears in a DoE paper)
  seen: number;
  correct: number;
  accuracy: number | null;
  syllabusDone: number; // share of subtopics ticked off
  priority: number;
  reason: "not-started" | "weak" | "review" | "strong";
  slug: string | null;
}

export function topicInsights(ds: DDataset, user: UserState): TopicInsight[] {
  const acc = new Map<string, { seen: number; correct: number }>();
  for (const [id, h] of Object.entries(user.history)) {
    const q = ds.byId.get(id);
    if (!q) continue;
    const k = `${q.classification.subject}|${q.classification.topic}`;
    const a = acc.get(k) ?? { seen: 0, correct: 0 };
    a.seen += h.seen;
    a.correct += h.correct;
    acc.set(k, a);
  }
  const out: TopicInsight[] = [];
  for (const r of ds.stats.topics) {
    if (r.topic === "Unclassified") continue;
    const k = `${r.subject}|${r.topic}`;
    const a = acc.get(k) ?? { seen: 0, correct: 0 };
    const subs = ds.meta.taxonomy[r.subject]?.topics[r.topic]?.subtopics ?? [];
    const done = subs.length ? subs.filter((s) => user.syllabusDone[`${k}|${s}`]).length / subs.length : 0;
    const accuracy = a.seen ? a.correct / a.seen : null;
    const weight = r.perDoePaper && r.perDoePaper > 0 ? r.perDoePaper : r.perPaper;
    // high weight, low accuracy and little syllabus coverage come first
    const gap = accuracy === null ? 1 : 1 - accuracy;
    const priority = weight * (0.35 + 0.65 * gap) * (1 - 0.5 * done);
    const reason: TopicInsight["reason"] = accuracy === null ? "not-started" : accuracy < 0.6 ? "weak" : accuracy < 0.8 ? "review" : "strong";
    out.push({
      key: k, subject: r.subject, topic: r.topic, weight, seen: a.seen, correct: a.correct, accuracy, syllabusDone: done, priority, reason,
      slug: ds.notes.find((n) => n.subject === r.subject && n.topic === r.topic && n.available)?.slug ?? null,
    });
  }
  return out.sort((a, b) => b.priority - a.priority);
}

export function weakAreas(ins: TopicInsight[], minSeen = 3) {
  return ins.filter((i) => i.seen >= minSeen && i.accuracy !== null && i.accuracy < 0.6).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
}

/** Days (YYYY-MM-DD) in a row, ending today or yesterday, on which the daily goal was met. */
export function streak(log: Record<string, number>, goal: number, today = new Date()): number {
  let n = 0;
  const d = new Date(today);
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  if ((log[key(d)] ?? 0) < goal) d.setDate(d.getDate() - 1);
  while ((log[key(d)] ?? 0) >= goal) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
