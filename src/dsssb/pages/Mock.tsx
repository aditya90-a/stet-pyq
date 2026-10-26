import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { IFlag, IPlay, ITimer } from "../../components/Icons";
import { fmtDuration } from "../../lib/format";
import { AnswerPanel, HBar, Opts, PageHead, QStem, useNames } from "../components";
import { baseConfig, buildTest, eligible, fullMockQuota, scoreTest, type TestConfig, type TestState } from "../engine";
import { useLang, useT } from "../i18n";
import { useD } from "../store";
import { incorrectIds, recordAnswer, type Attempt, type UserState } from "../state";

const MIN_PER_Q = 0.6; // 120 minutes for 200 questions

export function DMock() {
  const { ds, user, updateUser } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState<string>(sp.get("preset") ?? "full");
  const [subject, setSubject] = useState("Computer Science");
  const [topics, setTopics] = useState<string[]>([]);
  const [paper, setPaper] = useState(ds.papers[0]?.id ?? "");
  const [count, setCount] = useState(25);
  const [doeOnly, setDoeOnly] = useState(false);
  const [includeDisputed, setIncludeDisputed] = useState(false);
  const [instant, setInstant] = useState(false);
  const ids = sp.get("ids");

  const start = (c: TestConfig) => {
    const items = buildTest(ds, c);
    if (!items.length) return;
    const st: TestState = { id: `t${Date.now()}`, config: c, items, responses: {}, marked: [], current: 0, startedAt: Date.now(), elapsedSec: 0 };
    updateUser((s) => ({ ...s, activeTest: st }));
    nav("/dsssb/mock/run");
  };

  const cfg = (): TestConfig | null => {
    const common = { includeDisputed, doeOnly };
    if (ids) {
      const list = ids.split(",");
      return { ...baseConfig("custom", lang === "hi" ? "चुने हुए प्रश्न" : "Selected questions"), ...common, questionIds: list, count: list.length, minutes: Math.ceil(list.length * MIN_PER_Q), instant, includeDisputed: true };
    }
    if (tab === "full") return { ...baseConfig("full", t("fullMock")), ...common, quota: fullMockQuota(ds), count: 200, minutes: 120 };
    if (tab === "sectional") return { ...baseConfig("sectional", `${names.subject(subject)}`), ...common, subjects: [subject], count, minutes: Math.ceil(count * MIN_PER_Q), instant };
    if (tab === "topic") return { ...baseConfig("topic", topics.map((x) => x.split("|")[1]).join(", ") || t("topicTest")), ...common, topics, count, minutes: Math.ceil(count * MIN_PER_Q), instant };
    if (tab === "paper") {
      const p = ds.paperById.get(paper)!;
      return { ...baseConfig("paper", lang === "hi" ? p.labelHi : p.label), papers: [paper], includeDisputed: true, count: 200, minutes: 120, shuffle: false };
    }
    if (tab === "incorrect") {
      const list = incorrectIds(user);
      return { ...baseConfig("incorrect", t("incorrect")), questionIds: list, count: list.length, minutes: Math.ceil(list.length * MIN_PER_Q), instant: true, includeDisputed: true };
    }
    return { ...baseConfig("quick", t("quickPractice")), ...common, count: 20, minutes: null, instant: true };
  };
  const c = cfg();
  const available = c ? (c.quota ? Object.values(c.quota).reduce((a, b) => a + b, 0) : Math.min(c.count, eligible(ds, c).length)) : 0;
  const pool = c ? eligible(ds, c).length : 0;
  const tabs: [string, string][] = [
    ["full", t("fullMock")],
    ["sectional", t("sectional")],
    ["topic", t("topicTest")],
    ["paper", t("pastPaper")],
    ["quick", t("quickPractice")],
    ["incorrect", t("incorrect")],
  ];
  const active = user.activeTest;

  return (
    <div className="dpage">
      <PageHead title={t("mock")} sub={lang === "hi" ? "DSSSB पैटर्न: हर सही उत्तर +1, हर गलत उत्तर −0.25, छोड़ा गया 0।" : "DSSSB marking: +1 for each correct answer, −0.25 for each wrong one, 0 if skipped."} />
      {active && (
        <div className="notice notice-accent">
          <ITimer />
          <div>
            {lang === "hi" ? "अधूरा टेस्ट" : "Unfinished test"}: <strong>{active.config.title}</strong> ({Object.keys(active.responses).length}/{active.items.length}){" "}
            <Link to="/dsssb/mock/run">{lang === "hi" ? "जारी रखें" : "Resume"}</Link> ·{" "}
            <button className="linklike" onClick={() => updateUser((s) => ({ ...s, activeTest: null }))}>
              {lang === "hi" ? "छोड़ें" : "Discard"}
            </button>
          </div>
        </div>
      )}
      {!ids && (
        <div className="tabs" role="tablist">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tabchip ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="card mock-cfg">
        {ids && <p>{lang === "hi" ? `${ids.split(",").length} चुने हुए प्रश्नों से टेस्ट` : `Test from ${ids.split(",").length} selected questions`}</p>}
        {!ids && tab === "full" && c?.quota && (
          <>
            <p className="small">
              {lang === "hi"
                ? "आधिकारिक योजना जैसा: 200 प्रश्न, 120 मिनट। खंड B को CS और शिक्षण पद्धति में DoE प्रश्नपत्रों के औसत अनुपात से बाँटा गया है।"
                : "Mirrors the official scheme: 200 questions in 120 minutes. Section B is split between CS and teaching methodology in the average proportion seen in DoE papers."}
            </p>
            <div className="quota">
              {Object.entries(c.quota).map(([s, n]) => (
                <span key={s} className="chip">
                  {names.subject(s)}: {n}
                </span>
              ))}
            </div>
          </>
        )}
        {!ids && tab === "sectional" && (
          <label className="field">
            {t("subject")}
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {Object.keys(ds.meta.taxonomy).map((s) => (
                <option key={s} value={s}>
                  {names.subject(s)}
                </option>
              ))}
            </select>
          </label>
        )}
        {!ids && tab === "topic" && (
          <div className="topic-pick">
            {Object.entries(ds.meta.taxonomy).map(([s, sd]) => (
              <details key={s}>
                <summary>{names.subject(s)}</summary>
                <div className="choice-grid">
                  {Object.keys(sd.topics).map((tp) => {
                    const k = `${s}|${tp}`;
                    return (
                      <button key={k} type="button" className="choice" aria-pressed={topics.includes(k)} onClick={() => setTopics(topics.includes(k) ? topics.filter((x) => x !== k) : [...topics, k])}>
                        {names.topic(s, tp)}
                      </button>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
        {!ids && tab === "paper" && (
          <label className="field">
            {t("paper")}
            <select value={paper} onChange={(e) => setPaper(e.target.value)}>
              {ds.papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {lang === "hi" ? p.labelHi : p.label}
                </option>
              ))}
            </select>
            <span className="xs muted">{lang === "hi" ? "मूल क्रम में; DSSSB द्वारा हटाए गए प्रश्न शामिल नहीं।" : "In printed order; questions DSSSB dropped are left out."}</span>
          </label>
        )}
        {!ids && (tab === "sectional" || tab === "topic") && (
          <label className="field">
            {t("questionsCount")}: {count}
            <input type="range" min={10} max={100} step={5} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </label>
        )}
        {!ids && tab !== "paper" && tab !== "incorrect" && (
          <div className="toggles">
            <label className="fcheck">
              <input type="checkbox" checked={doeOnly} onChange={(e) => setDoeOnly(e.target.checked)} /> {lang === "hi" ? "केवल DoE प्रश्नपत्र" : "DoE papers only"}
            </label>
            <label className="fcheck">
              <input type="checkbox" checked={includeDisputed} onChange={(e) => setIncludeDisputed(e.target.checked)} /> {lang === "hi" ? "विवादित प्रश्न भी" : "Include disputed questions"}
            </label>
            {tab !== "full" && tab !== "quick" && (
              <label className="fcheck">
                <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} /> {lang === "hi" ? "तुरंत उत्तर दिखाएँ" : "Show answers as I go"}
              </label>
            )}
          </div>
        )}
        <p className="xs muted">
          {lang === "hi" ? "उपलब्ध प्रश्न" : "Eligible questions"}: {pool} · {c?.minutes ? `${c.minutes} ${t("minutes")}` : lang === "hi" ? "समय सीमा नहीं" : "untimed"} · −{c?.negative ?? 0.25}
        </p>
        <button className="btn btn-primary btn-lg btn-block" disabled={!c || !available || (tab === "topic" && !topics.length && !ids)} onClick={() => c && start(c)}>
          <IPlay /> {t("start")} ({available})
        </button>
      </div>

      {user.attempts.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{t("history")}</h2>
          </div>
          <div className="list card">
            {user.attempts.map((a) => (
              <Link key={a.id} className="li" to={`/dsssb/mock/result/${a.id}`}>
                <div className="li-body">
                  <span className="li-title">{a.title}</span>
                  <span className="li-sub">
                    {new Date(a.finishedAt).toLocaleString()} · {a.correct}✓ {a.wrong}✗ {a.unanswered}– · {fmtDuration(a.elapsedSec)}
                  </span>
                </div>
                <span className="li-end">
                  <strong>
                    {a.marks}/{a.maxMarks}
                  </strong>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function DMockRun() {
  const { ds, user, updateUser } = useD();
  const { lang } = useLang();
  const t = useT();
  const nav = useNavigate();
  const st = user.activeTest;
  const [showPalette, setShowPalette] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const elapsed = st ? Math.floor((now - st.startedAt) / 1000) : 0;
  const limit = st?.config.minutes ? st.config.minutes * 60 : null;
  const left = limit !== null ? Math.max(0, limit - elapsed) : null;

  const submit = () => {
    if (!st) return;
    const res = scoreTest(ds, st, st.config.negative);
    const attempt: Attempt = {
      id: st.id, title: st.config.title, kind: st.config.kind, finishedAt: Date.now(), elapsedSec: Math.min(elapsed, limit ?? elapsed),
      total: res.total, correct: res.correct, wrong: res.wrong, unanswered: res.unanswered, marks: res.marks, maxMarks: res.maxMarks,
      negative: st.config.negative, responses: st.responses, items: st.items,
    };
    updateUser((s) => {
      let n = s;
      if (!st.config.instant) for (const r of res.perQuestion) if (r.correct !== null) n = recordAnswer(n, r.id, r.correct);
      return { ...n, attempts: [attempt, ...n.attempts].slice(0, 60), activeTest: null };
    });
    nav(`/dsssb/mock/result/${st.id}`, { replace: true });
  };
  useEffect(() => {
    if (left === 0) submit();
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!st)
    return (
      <div className="dpage">
        <p>{lang === "hi" ? "कोई सक्रिय टेस्ट नहीं।" : "No active test."}</p>
        <Link to="/dsssb/mock">{t("mock")}</Link>
      </div>
    );
  const i = Math.min(st.current, st.items.length - 1);
  const q = ds.byId.get(st.items[i].id)!;
  const chosen = st.responses[q.id] ?? null;
  const reveal = st.config.instant && chosen !== null;
  const setCur = (n: number) => updateUser((s) => (s.activeTest ? { ...s, activeTest: { ...s.activeTest, current: Math.max(0, Math.min(st.items.length - 1, n)) } } : s));
  const pick = (opt: number) => {
    if (reveal) return;
    updateUser((s) => {
      if (!s.activeTest) return s;
      let n: UserState = { ...s, activeTest: { ...s.activeTest, responses: { ...s.activeTest.responses, [q.id]: opt } } };
      if (st.config.instant) n = recordAnswer(n, q.id, q.answer.indices.includes(opt));
      return n;
    });
  };
  const clearResp = () =>
    updateUser((s) => {
      if (!s.activeTest) return s;
      const r = { ...s.activeTest.responses };
      delete r[q.id];
      return { ...s, activeTest: { ...s.activeTest, responses: r } };
    });
  const toggleMark = () =>
    updateUser((s) => (s.activeTest ? { ...s, activeTest: { ...s.activeTest, marked: s.activeTest.marked.includes(q.id) ? s.activeTest.marked.filter((x) => x !== q.id) : [...s.activeTest.marked, q.id] } } : s));
  const answered = Object.values(st.responses).filter((v) => v !== null && v !== undefined).length;
  const exit = () => {
    if (window.confirm(lang === "hi" ? "टेस्ट जमा करें?" : "Submit the test now?")) submit();
  };
  return (
    <div className="runner">
      <div className="runbar">
        <div className="runbar-top">
          <strong className="clamp1">{st.config.title}</strong>
          {left !== null && (
            <span className={`timer ${left < 300 ? "low" : ""}`} aria-live="off">
              <ITimer /> {fmtDuration(left)}
            </span>
          )}
          <button className="btn btn-primary btn-sm" onClick={exit}>
            {t("submit")}
          </button>
        </div>
        <div className="progress-top" aria-hidden="true">
          <span style={{ width: `${(100 * answered) / st.items.length}%` }} />
        </div>
      </div>
      <div className="runner-body">
        <div className="runner-q">
          <div className="qv-meta">
            <span className="chip chip-accent">
              Q{i + 1} / {st.items.length}
            </span>
            <span className="chip">{q.classification.subject}</span>
            {st.marked.includes(q.id) && (
              <span className="chip chip-warning">
                <IFlag /> {t("markReview")}
              </span>
            )}
          </div>
          <QStem q={q} lang={lang} />
          <Opts q={q} lang={lang} chosen={chosen} reveal={reveal} onPick={pick} />
          {reveal && <AnswerPanel q={q} chosen={chosen} />}
          <div className="runfoot">
            <button className="btn btn-soft" onClick={() => setCur(i - 1)} disabled={i === 0}>
              {t("prev")}
            </button>
            <button className="btn btn-soft" onClick={toggleMark}>
              <IFlag /> {st.marked.includes(q.id) ? "✓" : ""}
            </button>
            <button className="btn btn-soft" onClick={clearResp} disabled={chosen === null || reveal}>
              {t("clearResponse")}
            </button>
            <button className="btn btn-soft palette-btn" onClick={() => setShowPalette(!showPalette)}>
              {answered}/{st.items.length}
            </button>
            <button className="btn btn-primary" onClick={() => (i === st.items.length - 1 ? exit() : setCur(i + 1))}>
              {i === st.items.length - 1 ? t("submit") : t("next")}
            </button>
          </div>
        </div>
        <aside className={`runner-palette ${showPalette ? "open" : ""}`} aria-label="Question palette">
          <div className="pal-legend xs">
            <span className="pal answered" /> {lang === "hi" ? "उत्तर दिया" : "answered"} <span className="pal marked" /> {lang === "hi" ? "चिह्नित" : "marked"} <span className="pal" />{" "}
            {lang === "hi" ? "बाकी" : "not answered"}
          </div>
          <div className="pal-grid">
            {st.items.map((it, k) => {
              const a = st.responses[it.id] !== undefined && st.responses[it.id] !== null;
              const m = st.marked.includes(it.id);
              return (
                <button
                  key={it.id}
                  className={`pal ${a ? "answered" : ""} ${m ? "marked" : ""} ${k === i ? "current" : ""}`}
                  onClick={() => {
                    setCur(k);
                    setShowPalette(false);
                  }}
                  aria-label={`Question ${k + 1}`}
                >
                  {k + 1}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function DMockResult() {
  const { id } = useParams();
  const { ds, user } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const a = user.attempts.find((x) => x.id === id);
  const res = useMemo(() => (a ? scoreTest(ds, { items: a.items, responses: a.responses }, a.negative) : null), [a, ds]);
  const [filter, setFilter] = useState<"all" | "wrong" | "skipped">("wrong");
  if (!a || !res) return <div className="dpage">{lang === "hi" ? "परिणाम नहीं मिला" : "Result not found"}</div>;
  const shown = res.perQuestion.filter((r) => (filter === "all" ? true : filter === "wrong" ? r.correct === false : r.chosen === null));
  return (
    <div className="dpage">
      <PageHead title={`${t("result")}: ${a.title}`} sub={`${new Date(a.finishedAt).toLocaleString()} · ${fmtDuration(a.elapsedSec)}`} />
      <div className="result-hero card">
        <div>
          <strong className="big">
            {res.marks}
            <small>/{res.maxMarks}</small>
          </strong>
          <span>{t("score")} (+1 / −{a.negative})</span>
        </div>
        <div className="dkpis">
          <div className="dkpi tone-good">
            <strong>{res.correct}</strong>
            <span>{t("correct")}</span>
          </div>
          <div className="dkpi tone-critical">
            <strong>{res.wrong}</strong>
            <span>
              {t("wrong")} (−{(res.wrong * a.negative).toFixed(2)})
            </span>
          </div>
          <div className="dkpi">
            <strong>{res.unanswered}</strong>
            <span>{t("skipped")}</span>
          </div>
          <div className="dkpi">
            <strong>{res.accuracyPct}%</strong>
            <span>{t("accuracy")}</span>
          </div>
        </div>
      </div>
      <section className="section">
        <div className="section-head">
          <h2>{t("sectionWise")}</h2>
        </div>
        <div className="table-wrap card">
          <table className="dtable">
            <thead>
              <tr>
                <th>{t("subject")}</th>
                <th className="num">{t("questionsCount")}</th>
                <th className="num">✓</th>
                <th className="num">✗</th>
                <th className="num">–</th>
                <th className="num">{t("score")}</th>
              </tr>
            </thead>
            <tbody>
              {res.bySubject.map((s) => (
                <tr key={s.name}>
                  <td>{names.subject(s.name)}</td>
                  <td className="num">{s.total}</td>
                  <td className="num">{s.correct}</td>
                  <td className="num">{s.wrong}</td>
                  <td className="num">{s.unanswered}</td>
                  <td className="num">
                    <strong>{s.marks}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <h2>
            {t("topicWise")} · {t("weakAreas")}
          </h2>
        </div>
        <div className="card">
          {res.byTopic.slice(0, 10).map((s) => (
            <HBar key={s.name} label={s.name} value={s.correct} max={s.total} sub={`${s.correct}/${s.total}`} tone={s.correct / s.total < 0.5 ? "bad" : "good"} />
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <h2>{t("review")}</h2>
          <div className="seg" role="group">
            {(["wrong", "skipped", "all"] as const).map((k) => (
              <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {k === "wrong" ? t("wrong") : k === "skipped" ? t("skipped") : t("all")}
              </button>
            ))}
          </div>
        </div>
        {shown.map((r) => {
          const q = ds.byId.get(r.id)!;
          return (
            <article key={r.id} className="card qv review-q">
              <div className="qv-meta">
                <span className={`chip ${r.correct ? "tone-good" : r.correct === false ? "tone-critical" : ""}`}>
                  {r.correct ? t("correct") : r.correct === false ? t("wrong") : t("skipped")}
                </span>
                <Link className="chip chip-accent" to={`/dsssb/q/${q.id}`}>
                  {names.paper(q.paperId)} · Q{q.qno}
                </Link>
              </div>
              <QStem q={q} lang={lang} />
              <Opts q={q} lang={lang} chosen={r.chosen} reveal />
              <AnswerPanel q={q} chosen={r.chosen} />
            </article>
          );
        })}
      </section>
      <Link to="/dsssb/mock" className="btn btn-soft btn-block">
        {t("mock")}
      </Link>
    </div>
  );
}
