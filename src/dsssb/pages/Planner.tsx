import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ITrash } from "../../components/Icons";
import { Stepper } from "../../components/ui";
import { HBar, Kpi, PageHead, useNames } from "../components";
import { useLang, useT } from "../i18n";
import { streak, topicInsights } from "../insights";
import { useD } from "../store";
import { EMPTY, isDue, REVIEW_DAYS, reviewDue, today, type Task, type UserState } from "../state";
import { daysUntil, EXAM_START } from "./Home";

export function DPlanner() {
  const { ds, user, updateUser } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const d = today();
  const done = user.planner.log[d] ?? 0;
  const goal = user.planner.dailyGoal;
  const tasks = user.planner.tasks.filter((x) => x.date === d);
  const ins = useMemo(() => topicInsights(ds, user), [ds, user]);
  const dueCards = Object.values(user.cards).filter((c) => isDue(c)).length;
  const reviews = Object.entries(user.topicReviews).sort((a, b) => a[1].last + REVIEW_DAYS[a[1].stage] * 864e5 - (b[1].last + REVIEW_DAYS[b[1].stage] * 864e5));

  const setTasks = (fn: (ts: Task[]) => Task[]) => updateUser((s) => ({ ...s, planner: { ...s.planner, tasks: fn(s.planner.tasks) } }));
  const add = (txt: string, link?: string) => setTasks((ts) => [...ts, { id: `k${Date.now()}${Math.random().toString(36).slice(2, 6)}`, date: d, text: txt, done: false, link }]);
  const suggest = () => {
    const top = ins.slice(0, 2);
    for (const i of top) {
      if (i.slug) add(`${lang === "hi" ? "नोट्स पढ़ें" : "Study notes"}: ${names.topic(i.subject, i.topic)}`, `/dsssb/notes/${i.slug}`);
      add(`${lang === "hi" ? "अभ्यास" : "Practise"}: ${names.topic(i.subject, i.topic)}`, `/dsssb/bank?topic=${encodeURIComponent(i.key)}`);
    }
    if (dueCards) add(`${lang === "hi" ? "फ़्लैशकार्ड दोहराएँ" : "Review flashcards"} (${dueCards})`, "/dsssb/revise?tab=cards");
    add(lang === "hi" ? "एक खंडीय टेस्ट दें" : "Take one sectional test", "/dsssb/mock?preset=sectional");
  };
  const days = Array.from({ length: 14 }, (_, k) => {
    const x = new Date();
    x.setDate(x.getDate() - (13 - k));
    return today(x);
  });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(user, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dsssb-progress-${d}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = (f: File) =>
    f.text().then((txt) => {
      try {
        const p = JSON.parse(txt) as Partial<UserState>;
        if (typeof p !== "object" || !p || !("history" in p)) throw new Error("not a progress file");
        updateUser(() => ({ ...structuredClone(EMPTY), ...p, planner: { ...EMPTY.planner, ...(p.planner ?? {}) } }));
        window.alert(lang === "hi" ? "प्रगति पुनर्स्थापित हुई" : "Progress restored");
      } catch (e) {
        window.alert(`${lang === "hi" ? "फ़ाइल पढ़ी नहीं जा सकी" : "Could not read the file"}: ${(e as Error).message}`);
      }
    });

  return (
    <div className="dpage">
      <PageHead title={t("planner")} sub={lang === "hi" ? "दैनिक लक्ष्य, पुनरावृत्ति अनुसूची और अध्ययन लॉग (इसी ब्राउज़र में सहेजा)।" : "Daily goals, a revision schedule and a study log (saved in this browser)."} />
      <div className="dkpis">
        <Kpi value={daysUntil(EXAM_START)} label={t("daysLeft")} tone="accent" />
        <Kpi value={`${done}/${goal}`} label={t("dailyGoal")} tone="good" />
        <Kpi value={streak(user.planner.log, goal)} label={lang === "hi" ? "लगातार दिन" : "day streak"} />
        <Kpi value={reviews.filter(([, r]) => reviewDue(r)).length} label={lang === "hi" ? "पुनरावृत्ति बाकी" : "revisions due"} />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>{t("dailyGoal")}</h2>
          <Stepper value={goal} onChange={(v) => updateUser((s) => ({ ...s, planner: { ...s.planner, dailyGoal: v } }))} min={10} max={200} step={10} label={t("dailyGoal")} format={(n) => `${n} Q`} />
        </div>
        <div className="card">
          <HBar label={t("today")} value={Math.min(done, goal)} max={goal} sub={`${done}/${goal}`} tone="good" />
          <div className="log-bars" aria-label="Last 14 days">
            {days.map((x) => {
              const n = user.planner.log[x] ?? 0;
              return (
                <div key={x} className="log-day" title={`${x}: ${n}`}>
                  <span className={n >= goal ? "met" : ""} style={{ height: `${Math.min(100, (100 * n) / Math.max(goal, 1))}%` }} />
                  <small>{x.slice(8)}</small>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{lang === "hi" ? "आज के कार्य" : "Today's tasks"}</h2>
          <button className="btn btn-soft btn-sm" onClick={suggest}>
            {lang === "hi" ? "योजना सुझाएँ" : "Suggest a plan"}
          </button>
        </div>
        <div className="card">
          <form
            className="task-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) add(text.trim());
              setText("");
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={lang === "hi" ? "नया कार्य…" : "Add a task…"} aria-label="New task" />
            <button className="btn btn-primary btn-sm" type="submit">
              +
            </button>
          </form>
          <ul className="tasks">
            {tasks.map((x) => (
              <li key={x.id} className={x.done ? "done" : ""}>
                <label>
                  <input type="checkbox" checked={x.done} onChange={() => setTasks((ts) => ts.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)))} />
                  {x.link ? <Link to={x.link}>{x.text}</Link> : <span>{x.text}</span>}
                </label>
                <button className="icon-btn" aria-label="Delete" onClick={() => setTasks((ts) => ts.filter((y) => y.id !== x.id))}>
                  <ITrash />
                </button>
              </li>
            ))}
            {!tasks.length && <li className="muted small">{lang === "hi" ? "आज कोई कार्य नहीं — “योजना सुझाएँ” दबाएँ।" : "No tasks yet — try “Suggest a plan”."}</li>}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{lang === "hi" ? "पुनरावृत्ति अनुसूची" : "Revision schedule"}</h2>
        </div>
        <p className="xs muted">
          {lang === "hi" ? "नोट्स में “पढ़ लिया” दबाने पर प्रकरण" : "Mark a topic studied in Notes and it comes back after"} {REVIEW_DAYS.join(", ")} {lang === "hi" ? "दिन बाद लौटता है।" : "days."}
        </p>
        <div className="list card">
          {reviews.map(([k, r]) => {
            const [s, tp] = k.split("|");
            const due = r.last + REVIEW_DAYS[r.stage] * 864e5;
            const slug = ds.notes.find((n) => n.subject === s && n.topic === tp)?.slug;
            return (
              <Link key={k} className="li" to={slug ? `/dsssb/notes/${slug}` : "/dsssb/notes"}>
                <div className="li-body">
                  <span className="li-title">{names.topic(s, tp)}</span>
                  <span className="li-sub">
                    {lang === "hi" ? "चरण" : "stage"} {r.stage + 1}/{REVIEW_DAYS.length} · {new Date(due).toLocaleDateString()}
                  </span>
                </div>
                {reviewDue(r) && <span className="chip chip-warning">{lang === "hi" ? "बाकी" : "due"}</span>}
              </Link>
            );
          })}
          {!reviews.length && <p className="muted small">{lang === "hi" ? "अभी कोई प्रकरण नहीं पढ़ा।" : "No topics studied yet."}</p>}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>
            {t("backup")} / {t("restore")}
          </h2>
        </div>
        <div className="card row-actions">
          <button className="btn btn-soft btn-sm" onClick={exportData}>
            {t("backup")}
          </button>
          <button className="btn btn-soft btn-sm" onClick={() => fileRef.current?.click()}>
            {t("restore")}
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          <span className="xs muted">{lang === "hi" ? "प्रगति केवल इस ब्राउज़र में रहती है; बैकअप फ़ाइल से दूसरे उपकरण पर ले जाएँ।" : "Progress lives only in this browser; use a backup file to move it to another device."}</span>
        </div>
      </section>
    </div>
  );
}
