import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ICalendar, IChevronL, IChevronR, IFlag, IFlame, IGrid, IRotate, ITarget, ITimer, ITrophy, IX, IZap } from "../components/Icons";
import { useImmersive } from "../components/Layout";
import { AnswerPanel, hasHindi, Options } from "../components/QuestionView";
import { AppBar, Bar, Choices, Empty, Section, Seg, Sheet, Stat, Stepper, Switch } from "../components/ui";
import { assetUrl, useData } from "../data/store";
import type { Dataset } from "../data/types";
import { fmtDuration, fmtNum } from "../lib/format";
import { buildTest, defaultConfig, eligible, scoreTest, type TestConfig, type TestState } from "../lib/practice";
import { rememberList } from "../lib/questionNav";
import { needsRevision, recordAttempt } from "../lib/storage";

/** Section sizes observed in every available paper (and in syllabus.jpeg); not an official notification. */
const OBSERVED_PATTERN: Record<string, number> = { "Computer Science": 100, "Art of Teaching": 30, "General Knowledge / Aptitude": 20 };

type Preset = "quick" | "repeated" | "mock" | "paper" | "mistakes" | "custom";

function presetConfig(ds: Dataset, preset: Preset, params: URLSearchParams, revise: string[]): { title: string; c: TestConfig } {
  const list = (k: string) => (params.get(k) ? [params.get(k)!] : []);
  const base = defaultConfig("practice");
  const filters = { subjects: list("subject"), topics: list("topic"), papers: list("paper"), years: list("year"), onlyRepeated: params.get("repeat") === "repeated" };
  const ids = params.get("ids");
  if (ids) return { title: "Revision set", c: { ...base, questionIds: ids.split(","), count: ids.split(",").length, excludeDisputed: false, onePerFamily: false } };
  switch (preset) {
    case "repeated":
      return { title: "Most repeated", c: { ...base, ...filters, onlyRepeated: true, count: 30, minutes: null } };
    case "mock":
      return { title: "Full mock test", c: { ...defaultConfig("mock"), sectionQuota: OBSERVED_PATTERN, count: 150, minutes: 150 } };
    case "paper": {
      const p = ds.paperById.get(params.get("paper") ?? "");
      return {
        title: p ? `Full paper · ${p.shortLabel}` : "Full paper",
        c: { ...defaultConfig("mock"), papers: p ? [p.id] : [], count: 150, minutes: 150, shuffleQuestions: false, onePerFamily: false, excludeDisputed: false },
      };
    }
    case "mistakes":
      return { title: "My mistakes", c: { ...base, questionIds: revise.slice(0, 300), count: Math.min(revise.length, 300), excludeDisputed: false, onePerFamily: false, minutes: null } };
    case "quick":
      return { title: "Quick 20", c: { ...base, count: 20, minutes: null } };
    default:
      return { title: "Custom practice", c: { ...base, ...filters, minutes: null } };
  }
}

function Setup({ preset, onStart }: { preset: Preset; onStart: (c: TestConfig) => void }) {
  const { ds, user } = useData();
  const [params] = useSearchParams();
  useImmersive(true);
  const init = useMemo(() => presetConfig(ds, preset, params, needsRevision(user)), [ds, preset, params, user]);
  const [c, setC] = useState<TestConfig>(init.c);
  const upd = (patch: Partial<TestConfig>) => setC((x) => ({ ...x, ...patch }));
  const pool = eligible(ds, c);
  const available = c.onePerFamily ? new Set(pool.map((q) => q.repeat.repeatGroup ?? q.id)).size : pool.length;
  const fixedShape = !!c.sectionQuota || preset === "paper";
  const count = c.sectionQuota ? 150 : fixedShape ? available : Math.min(c.count, available);
  const subjects = Object.keys(ds.stats.bySubject);
  const topics = [...new Set(ds.questions.filter((q) => !c.subjects.length || c.subjects.includes(q.classification.subject)).map((q) => q.classification.topic))].sort();
  const isMock = c.mode === "mock";

  return (
    <>
      <AppBar title={init.title} sub={isMock ? "Timed · answers shown after you submit" : "Answers shown as you go"} back fallback="/practice" />
      <div className="page" style={{ paddingBottom: 110 }}>
        <div className="stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Stat value={fmtNum(count)} label="questions" />
          <Stat value={c.minutes ? `${c.minutes} min` : "Off"} label="timer" />
        </div>
        {c.sectionQuota && <p className="small muted">100 Computer Science + 30 Teaching + 20 GK/aptitude, like the real paper. No negative marking.</p>}

        {!fixedShape && !c.questionIds && (
          <Section title="Questions">
            <div className="card stack" style={{ gap: 16 }}>
              <div className="row">
                <span className="spacer" style={{ fontWeight: 650 }}>
                  How many
                </span>
                <Stepper label="questions" value={c.count} min={5} max={150} step={5} onChange={(v) => upd({ count: v })} />
              </div>
              <Choices label="Subject" options={subjects.map((s) => [s, s])} value={c.subjects} onChange={(v) => upd({ subjects: v, topics: [] })} />
              <Choices label="Topic" options={topics.map((t) => [t, t])} value={c.topics} onChange={(v) => upd({ topics: v })} />
            </div>
          </Section>
        )}

        <Section title="Settings">
          <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {!c.sectionQuota && (
              <div className="switch-row">
                <div className="li-body">
                  <span>Timer</span>
                  <span>{c.minutes ? `${c.minutes} minutes` : "No time limit"}</span>
                </div>
                <Stepper label="minutes" value={c.minutes ?? 0} min={0} max={180} step={5} format={(n) => (n ? `${n}m` : "Off")} onChange={(v) => upd({ minutes: v || null })} />
              </div>
            )}
            {!isMock && <Switch label="Instant feedback" hint="See the answer and explanation after each question" checked={!!c.instant} onChange={(v) => upd({ instant: v })} />}
            {!fixedShape && !c.questionIds && <Switch label="Repeated questions only" hint="Asked in 2 or more papers" checked={c.onlyRepeated} onChange={(v) => upd({ onlyRepeated: v })} />}
          </div>
        </Section>
      </div>
      <div className="runfoot">
        <button className="btn btn-primary btn-lg" disabled={!count} onClick={() => onStart({ ...c, count, seed: Date.now() % 2147483647 })}>
          Start · {count} questions
        </button>
      </div>
    </>
  );
}

function Hub() {
  const { ds, user } = useData();
  const nav = useNavigate();
  const revise = needsRevision(user).length;
  const presets: { p: Preset; icon: typeof IZap; tint: string; title: string; sub: string; disabled?: boolean }[] = [
    { p: "quick", icon: IZap, tint: "mode-blue", title: "Quick 20", sub: "Random mix from all papers, answers as you go" },
    { p: "repeated", icon: IFlame, tint: "mode-gold", title: "Most repeated", sub: `${ds.stats.totals.repeatGroups} questions asked in 2+ papers` },
    { p: "mock", icon: ITimer, tint: "mode-rose", title: "Full mock test", sub: "150 questions · 150 minutes · exam pattern" },
    { p: "mistakes", icon: IRotate, tint: "mode-red", title: "My mistakes", sub: revise ? `${revise} questions to get right` : "Questions you get wrong land here", disabled: !revise },
    { p: "custom", icon: ITarget, tint: "mode-green", title: "Choose topic", sub: "Pick subject, topic and size" },
  ];
  return (
    <>
      <AppBar title="Practice" large />
      <div className="page">
        <div className="stack" style={{ gap: 10 }}>
          {presets.map((x) => (
            <button key={x.p} className="preset" disabled={x.disabled} style={x.disabled ? { opacity: 0.55 } : undefined} onClick={() => nav(`/practice?preset=${x.p}`)}>
              <span className={`qa-icon solid ${x.tint}`}>
                <x.icon />
              </span>
              <span className="li-body">
                <span className="li-title">{x.title}</span>
                <span className="li-sub">{x.sub}</span>
              </span>
              <IChevronR width={18} height={18} style={{ color: "var(--muted)" }} />
            </button>
          ))}
          <Link className="preset" to="/papers">
            <span className="qa-icon solid mode-violet">
              <ICalendar />
            </span>
            <span className="li-body">
              <span className="li-title">Attempt a past paper</span>
              <span className="li-sub">Any of the {ds.papers.length} shifts, exactly as asked</span>
            </span>
            <IChevronR width={18} height={18} style={{ color: "var(--muted)" }} />
          </Link>
        </div>
        {user.attempts.length > 0 && (
          <Section title="Recent results" action={<Link to="/saved?tab=history">All</Link>}>
            <div className="list">
              {user.attempts.slice(0, 3).map((a) => (
                <div key={a.id} className="li">
                  <span className="li-icon tint-accent">
                    <ITrophy />
                  </span>
                  <div className="li-body">
                    <span className="li-title">
                      {a.correct}/{a.total} correct
                    </span>
                    <span className="li-sub">
                      {a.mode === "mock" ? "Mock" : "Practice"} · {new Date(a.finishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {fmtDuration(a.elapsedSec)}
                    </span>
                  </div>
                  <span className="li-end num">{Math.round(a.scorePct)}%</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}

function Runner({ st, setSt, onSubmit, onQuit }: { st: TestState; setSt: (f: (s: TestState) => TestState) => void; onSubmit: () => void; onQuit: () => void }) {
  const { ds } = useData();
  useImmersive(true);
  const [cur, setCur] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [palette, setPalette] = useState(false);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const touch = useRef<{ x: number; y: number } | null>(null);
  const item = st.items[cur];
  const q = ds.byId.get(item.id)!;
  const p = ds.paperById.get(q.paperId)!;
  const instant = st.config.mode === "practice" && !!st.config.instant;
  const limit = st.config.minutes ? st.config.minutes * 60 : null;
  const elapsed = Math.floor((now - st.startedAt) / 1000);
  const remaining = limit !== null ? limit - elapsed : null;
  const isAnswered = (id: string) => st.responses[id] !== undefined && st.responses[id] !== null;
  const answered = st.items.filter((i) => isAnswered(i.id)).length;
  const chosen = st.responses[item.id] ?? null;
  const locked = instant && chosen !== null;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (remaining !== null && remaining <= 0) onSubmit();
  }, [remaining, onSubmit]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [cur]);

  const go = useCallback((d: number) => setCur((c) => Math.min(st.items.length - 1, Math.max(0, c + d))), [st.items.length]);
  const choose = (orig: number | null) => !locked && setSt((s) => ({ ...s, responses: { ...s.responses, [item.id]: orig } }));
  const toggleMark = () => setSt((s) => ({ ...s, marked: s.marked.includes(item.id) ? s.marked.filter((x) => x !== item.id) : [...s.marked, item.id] }));
  const submit = () => {
    const un = st.items.length - answered;
    if (window.confirm(un ? `Submit with ${un} unanswered question(s)?` : "Submit the test?")) onSubmit();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      const idx = "abcd".indexOf(k) >= 0 ? "abcd".indexOf(k) : "1234".indexOf(k);
      if (idx >= 0 && idx < item.order.length) choose(item.order[idx]);
      else if (k === "arrowright" || k === "n") go(1);
      else if (k === "arrowleft" || k === "p") go(-1);
      else if (k === "m") toggleMark();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const showHi = lang === "hi" && q.textHi;
  return (
    <>
      <div className="runbar">
        <div className="runbar-top">
          <button className="icon-btn" aria-label="Quit test" onClick={onQuit} style={{ marginLeft: -10 }}>
            <IX />
          </button>
          <strong className="num">
            {cur + 1}
            <span className="muted" style={{ fontWeight: 600 }}>
              {" "}
              / {st.items.length}
            </span>
          </strong>
          <span className="spacer" />
          <span className={`timer ${remaining !== null && remaining < 120 ? "low" : ""}`} role="timer" aria-label={remaining !== null ? "Time left" : "Time elapsed"}>
            <ITimer />
            {fmtDuration(Math.max(0, remaining ?? elapsed))}
          </span>
          <button className="icon-btn" aria-label="All questions" onClick={() => setPalette(true)} style={{ marginRight: -10 }}>
            <IGrid />
          </button>
        </div>
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${(100 * answered) / st.items.length}%` }} />
        </div>
      </div>

      <div
        className="page"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          if (Math.abs(dx) > 70 && Math.abs(dy) < 50) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        <article className="qv" aria-labelledby="run-q">
          <div className="qv-meta">
            <span className="chip chip-accent">
              {p.shortLabel} · Q{q.qno}
            </span>
            <span className="chip">{q.classification.topic}</span>
            {st.marked.includes(item.id) && (
              <span className="chip chip-warning">
                <IFlag /> Marked
              </span>
            )}
          </div>
          {hasHindi(q) && (
            <Seg
              label="Language"
              value={lang}
              onChange={setLang}
              options={[
                ["en", "English"],
                ["hi", "हिन्दी"],
              ]}
            />
          )}
          <div id="run-q" className={showHi ? "qv-text hi" : "qv-text"} lang={showHi ? "hi" : "en"}>
            {showHi ? q.textHi : q.text}
          </div>
          {q.figures.map((f) => (
            <img key={f.file} className="figure" src={assetUrl(f.file)} alt="Question figure" />
          ))}
          <Options q={q} lang={lang} order={item.order} chosen={chosen} reveal={locked} onPick={(orig) => choose(chosen === orig && !instant ? null : orig)} />
          {locked && <AnswerPanel q={q} chosen={chosen} order={item.order} />}
        </article>
      </div>

      <div className="runfoot">
        <button className="btn" aria-label="Previous question" onClick={() => go(-1)} disabled={cur === 0}>
          <IChevronL />
        </button>
        {!instant && (
          <button className="btn" onClick={toggleMark} aria-pressed={st.marked.includes(item.id)} aria-label="Mark for review" style={st.marked.includes(item.id) ? { color: "var(--warning-ink)" } : undefined}>
            <IFlag />
          </button>
        )}
        {cur < st.items.length - 1 ? (
          <button className="btn btn-primary" onClick={() => go(1)}>
            {chosen === null ? "Skip" : "Next"} <IChevronR />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={submit}>
            Finish
          </button>
        )}
      </div>

      <Sheet
        open={palette}
        onClose={() => setPalette(false)}
        title={`${answered} of ${st.items.length} answered`}
        footer={
          <button
            className="btn btn-primary"
            onClick={() => {
              setPalette(false);
              submit();
            }}
          >
            Submit test
          </button>
        }
      >
        <div className="legend">
          {instant ? (
            <>
              <span>
                <i style={{ background: "var(--good)" }} />
                Correct
              </span>
              <span>
                <i style={{ background: "var(--critical)" }} />
                Wrong
              </span>
            </>
          ) : (
            <>
              <span>
                <i style={{ background: "var(--accent)" }} />
                Answered
              </span>
              <span>
                <i style={{ background: "var(--warning)" }} />
                Marked
              </span>
            </>
          )}
          <span>
            <i style={{ border: "1px solid var(--line-strong)" }} />
            Not answered
          </span>
        </div>
        <div className="palette">
          {st.items.map((it, i) => {
            const a = isAnswered(it.id);
            const right = instant && a ? st.responses[it.id] === ds.byId.get(it.id)!.answer.index : null;
            const cls = [right === true ? "right" : right === false ? "wrongp" : a ? "answered" : "", st.marked.includes(it.id) ? "marked" : "", i === cur ? "current" : ""].join(" ");
            return (
              <button
                key={it.id}
                className={cls}
                onClick={() => {
                  setCur(i);
                  setPalette(false);
                }}
                aria-label={`Question ${i + 1}${a ? ", answered" : ""}${st.marked.includes(it.id) ? ", marked" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const color = pct >= 70 ? "var(--good)" : pct >= 40 ? "var(--warning)" : "var(--critical)";
  return (
    <div className="ring">
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="12" />
        <circle cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <div className="ring-label">
        <strong className="num">{Math.round(pct)}%</strong>
        <span className="xs muted">score</span>
      </div>
    </div>
  );
}

function Result({ ds, st, onNew }: { ds: Dataset; st: TestState; onNew: () => void }) {
  const res = useMemo(() => scoreTest(ds, st), [ds, st]);
  const [view, setView] = useState<"wrong" | "skipped" | "correct">(res.wrong ? "wrong" : res.unanswered ? "skipped" : "correct");
  const list = useMemo(() => res.perQuestion.filter((r) => (view === "wrong" ? r.correct === false : view === "skipped" ? r.correct === null : r.correct === true)), [res, view]);
  useEffect(() => rememberList(list.map((r) => r.id), "Test review"), [list]);
  const retry = res.perQuestion.filter((r) => r.correct !== true).map((r) => r.id);
  const nav = useNavigate();
  return (
    <>
      <AppBar title="Result" sub={`${st.config.mode === "mock" ? "Mock test" : "Practice"} · ${fmtDuration(st.elapsedSec)}`} />
      <div className="page">
        <div className="card result-hero">
          <Ring pct={res.scorePct} />
          <div className="stack" style={{ gap: 4 }}>
            <strong style={{ fontSize: 20 }}>
              {res.correct} / {res.total} correct
            </strong>
            <span className="small muted">
              {res.wrong} wrong · {res.unanswered} skipped
            </span>
            <span className="small muted">Accuracy on attempted: {res.accuracyPct}%</span>
          </div>
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          {retry.length > 0 && (
            <button
              className="btn btn-block"
              onClick={() => {
                onNew();
                nav(`/practice?ids=${retry.join(",")}`);
              }}
            >
              <IRotate /> Retry {retry.length}
            </button>
          )}
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              onNew();
              nav("/practice");
            }}
          >
            New test
          </button>
        </div>

        <Section title="By topic">
          <div className="list">
            {res.byTopic.map((t) => (
              <div key={t.topic} className="li">
                <div className="li-body">
                  <span className="li-title">{t.topic}</span>
                  <Bar value={t.correct} max={t.total} tone="good" />
                </div>
                <span className="li-end num">
                  {t.correct}/{t.total}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Review answers">
          <Seg
            label="Review"
            value={view}
            onChange={setView}
            options={[
              ["wrong", `Wrong ${res.wrong}`],
              ["skipped", `Skipped ${res.unanswered}`],
              ["correct", `Right ${res.correct}`],
            ]}
          />
          <div className="stack" style={{ gap: 10 }}>
            {list.map((r) => {
              const q = ds.byId.get(r.id)!;
              return (
                <Link key={r.id} className="qrow" to={`/q/${q.id}`}>
                  <div className="qrow-meta">
                    <span className="chip">Q{st.items.findIndex((i) => i.id === r.id) + 1}</span>
                    <span className="chip">{q.classification.topic}</span>
                  </div>
                  <div className="qrow-text">{q.text}</div>
                  {r.chosen !== null && r.chosen !== r.key && (
                    <div className="qrow-ans" style={{ color: "var(--critical-ink)" }}>
                      <IX /> <span>You: {q.options[r.chosen].text}</span>
                    </div>
                  )}
                  <div className="qrow-ans">
                    <ITarget /> <span>Answer: {q.options[r.key].text}</span>
                  </div>
                </Link>
              );
            })}
            {!list.length && <Empty title="Nothing here" />}
          </div>
        </Section>
      </div>
    </>
  );
}

export function Practice() {
  const { ds, user, updateUser } = useData();
  const [params, setParams] = useSearchParams();
  const [done, setDone] = useState<TestState | null>(null);
  const active = user.activeTest;
  const preset = (params.get("preset") as Preset | null) ?? ([...params.keys()].length ? "custom" : null);

  const start = (c: TestConfig) => {
    if (active && !window.confirm("Discard your unfinished test and start this one?")) return;
    const items = buildTest(ds, c);
    const st: TestState = { id: `T${Date.now()}`, config: c, items, responses: {}, marked: [], startedAt: Date.now(), submittedAt: null, elapsedSec: 0 };
    setDone(null);
    updateUser((s) => ({ ...s, activeTest: st }));
    setParams(new URLSearchParams(), { replace: true });
  };
  const setSt = (f: (s: TestState) => TestState) => updateUser((s) => (s.activeTest ? { ...s, activeTest: f(s.activeTest) } : s));
  const submit = useCallback(() => {
    if (!active) return;
    const fin: TestState = { ...active, submittedAt: Date.now(), elapsedSec: Math.min(Math.floor((Date.now() - active.startedAt) / 1000), active.config.minutes ? active.config.minutes * 60 : Infinity) };
    const res = scoreTest(ds, fin);
    updateUser((s) => recordAttempt(s, fin, res));
    setDone(fin);
  }, [active, ds, updateUser]);
  const quit = () => {
    if (window.confirm("Quit this test? Your answers so far will be discarded.")) updateUser((s) => ({ ...s, activeTest: null }));
  };

  if (done) return <Result ds={ds} st={done} onNew={() => setDone(null)} />;
  if (active && !preset) return <Runner st={active} setSt={setSt} onSubmit={submit} onQuit={quit} />;
  if (preset) return <Setup key={params.toString()} preset={preset} onStart={start} />;
  return <Hub />;
}
