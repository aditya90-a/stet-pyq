import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HBar, Kpi, PageHead, useNames } from "../components";
import { useLang, useT } from "../i18n";
import { topicInsights, weakAreas } from "../insights";
import { useD } from "../store";

export function DAnalytics() {
  const { ds, user } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const [part, setPart] = useState<"B" | "A">("B");
  const ins = useMemo(() => topicInsights(ds, user), [ds, user]);
  const weak = weakAreas(ins);
  const hist = Object.values(user.history);
  const answered = hist.reduce((a, h) => a + h.seen, 0);
  const correct = hist.reduce((a, h) => a + h.correct, 0);
  const subjects = Object.entries(ds.meta.taxonomy).filter(([, v]) => v.part === part);
  const weightRows = ds.stats.topics.filter((r) => ds.meta.taxonomy[r.subject]?.part === part && r.topic !== "Unclassified");
  const maxW = Math.max(1, ...weightRows.map((r) => r.perPaper));
  const syl = Object.entries(ds.meta.taxonomy).map(([s, sd]) => {
    const keys = Object.entries(sd.topics).flatMap(([tp, tv]) => tv.subtopics.map((st) => `${s}|${tp}|${st}`));
    return { s, done: keys.filter((k) => user.syllabusDone[k]).length, total: keys.length };
  });
  const mocks = user.attempts.slice(0, 12).reverse();
  return (
    <div className="dpage">
      <PageHead title={t("analytics")} sub={lang === "hi" ? "पिछले प्रश्नपत्रों का भारांक + आपकी अपनी प्रगति (केवल इस ब्राउज़र में)।" : "Past-paper weightage plus your own progress (stored only in this browser)."} />
      <div className="dkpis">
        <Kpi value={Object.keys(user.history).length} label={lang === "hi" ? "प्रश्न हल किए" : "questions tried"} />
        <Kpi value={answered ? `${Math.round((100 * correct) / answered)}%` : "–"} label={t("accuracy")} tone="good" />
        <Kpi value={user.attempts.length} label={lang === "hi" ? "टेस्ट" : "tests"} />
        <Kpi value={weak.length} label={t("weakAreas")} tone="critical" />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>{t("recommendations")}</h2>
        </div>
        <p className="xs muted">
          {lang === "hi"
            ? "क्रम = ऐतिहासिक भारांक × (1 − आपकी सटीकता) × शेष पाठ्यक्रम। सुझाव मार्गदर्शन हैं, अनुमान नहीं।"
            : "Ranked by historical weightage × (1 − your accuracy) × syllabus left. Guidance from past papers, not a prediction of the next paper."}
        </p>
        <div className="list card">
          {ins.slice(0, 8).map((i) => (
            <div key={i.key} className="li rec">
              <div className="li-body">
                <span className="li-title">
                  {names.topic(i.subject, i.topic)} <span className="xs muted">· {names.subject(i.subject)}</span>
                </span>
                <span className="li-sub">
                  {i.weight.toFixed(1)} {t("perPaper")} ·{" "}
                  {i.accuracy === null
                    ? lang === "hi"
                      ? "अभी शुरू नहीं"
                      : "not started"
                    : `${Math.round(100 * i.accuracy)}% ${t("accuracy").toLowerCase()} (${i.seen})`}{" "}
                  · {Math.round(100 * i.syllabusDone)}% {t("syllabus").toLowerCase()}
                </span>
              </div>
              <span className="li-end rec-actions">
                {i.slug && (
                  <Link className="btn btn-soft btn-sm" to={`/dsssb/notes/${i.slug}`}>
                    {t("notes")}
                  </Link>
                )}
                <Link className="btn btn-primary btn-sm" to={`/dsssb/bank?topic=${encodeURIComponent(i.key)}`}>
                  {t("practice")}
                </Link>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("weakAreas")}</h2>
        </div>
        <div className="card">
          {weak.length ? (
            weak.slice(0, 10).map((i) => <HBar key={i.key} label={names.topic(i.subject, i.topic)} value={i.correct} max={i.seen} sub={`${Math.round(100 * (i.accuracy ?? 0))}%`} tone="bad" to={`/dsssb/bank?topic=${encodeURIComponent(i.key)}`} />)
          ) : (
            <p className="muted small">{lang === "hi" ? "कम से कम 3 प्रयास वाले प्रकरणों में से कोई 60% से नीचे नहीं।" : "No topic with 3+ attempts is below 60% accuracy yet."}</p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>
            {lang === "hi" ? "ऐतिहासिक प्रकरण भारांक" : "Historical topic weightage"} ({t("perPaper")})
          </h2>
          <div className="seg" role="group">
            <button aria-pressed={part === "B"} onClick={() => setPart("B")}>
              Section B
            </button>
            <button aria-pressed={part === "A"} onClick={() => setPart("A")}>
              Section A
            </button>
          </div>
        </div>
        {subjects.map(([s]) => (
          <div key={s} className="card">
            <strong>{names.subject(s)}</strong>
            {weightRows
              .filter((r) => r.subject === s)
              .map((r) => (
                <HBar key={r.topic} label={names.topic(r.subject, r.topic)} value={r.perPaper} max={maxW} sub={`${r.perPaper} · ${r.papersAsked}/${ds.papers.length}`} to={`/dsssb/bank?topic=${encodeURIComponent(`${r.subject}|${r.topic}`)}`} />
              ))}
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{lang === "hi" ? "पाठ्यक्रम प्रगति" : "Syllabus progress"}</h2>
          <Link to="/dsssb/syllabus" className="xs">
            {t("syllabus")} →
          </Link>
        </div>
        <div className="card">
          {syl.map((x) => (
            <HBar key={x.s} label={names.subject(x.s)} value={x.done} max={x.total} sub={`${x.done}/${x.total}`} tone="good" />
          ))}
        </div>
      </section>

      {mocks.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{lang === "hi" ? "टेस्ट प्रवृत्ति" : "Test trend"}</h2>
          </div>
          <div className="card">
            {mocks.map((a) => (
              <HBar key={a.id} label={`${new Date(a.finishedAt).toLocaleDateString()} · ${a.title}`} value={Math.max(0, a.marks)} max={a.maxMarks} sub={`${a.marks}/${a.maxMarks}`} to={`/dsssb/mock/result/${a.id}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
