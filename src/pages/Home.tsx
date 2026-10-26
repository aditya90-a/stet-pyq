import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { IBook, ICalendar, IChevronR, IFlame, IInfo, IMoon, IPlay, ISun, ITimer } from "../components/Icons";
import { useData } from "../data/store";
import { fmtNum } from "../lib/format";
import { rememberList } from "../lib/questionNav";
import { progressSummary } from "../lib/storage";
import { useTheme } from "../lib/theme";

const DAILY_GOAL = 20;

function GoalRing({ value, goal }: { value: number; goal: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, value / goal);
  return (
    <div className="goal-ring" role="img" aria-label={`${value} of ${goal} questions today`}>
      <svg viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgb(255 255 255 / 22%)" strokeWidth="8" />
        <circle cx="42" cy="42" r={r} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} />
      </svg>
      <span className="num">
        <strong>{value}</strong>/{goal}
      </span>
    </div>
  );
}

export function Home() {
  const { ds, user } = useData();
  const { effective, toggle } = useTheme();
  const t = ds.stats.totals;
  const me = progressSummary(user);
  const top = useMemo(() => ds.groups.repeat.filter((g) => g.distinctPapers > 1).slice(0, 5), [ds]);
  const active = user.activeTest;
  const dayStart = new Date().setHours(0, 0, 0, 0);
  const today = Object.values(user.history).filter((h) => h.lastAt >= dayStart).length;
  useEffect(() => rememberList(top.map((g) => g.canonical), "Asked most often"), [top]);

  const modes = [
    { to: "/repeats", icon: IFlame, tone: "gold", title: "Most repeated", sub: `${fmtNum(t.repeatGroups)} questions` },
    { to: "/practice?preset=mock", icon: ITimer, tone: "rose", title: "Mock test", sub: "150 Q · 150 min" },
    { to: "/topics", icon: IBook, tone: "green", title: "Topic-wise", sub: "Unit by unit" },
    { to: "/papers", icon: ICalendar, tone: "violet", title: "Past papers", sub: `${t.papers} shifts` },
  ];

  return (
    <>
      <header className="appbar">
        <span className="logo" aria-hidden="true">
          Q
        </span>
        <div className="appbar-title">
          <h1>STET PYQ</h1>
          <div className="sub">Computer Science · Class 11–12</div>
        </div>
        <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${effective === "dark" ? "light" : "dark"} theme`}>
          {effective === "dark" ? <ISun /> : <IMoon />}
        </button>
        <Link className="icon-btn" to="/about" aria-label="About">
          <IInfo />
        </Link>
      </header>

      <div className="page">
        <section className="hero">
          <div className="hero-row">
            <div className="hero-copy">
              <div className="hero-kicker">{active ? "Test in progress" : "Today's goal"}</div>
              <div className="hero-title">
                {active
                  ? `${Object.values(active.responses).filter((v) => v !== null).length} of ${active.items.length} answered`
                  : today >= DAILY_GOAL
                    ? "Goal done. Keep going!"
                    : `${DAILY_GOAL - today} questions to go`}
              </div>
            </div>
            <GoalRing value={today} goal={DAILY_GOAL} />
          </div>
          <Link className="btn btn-white btn-lg btn-block" to={active ? "/practice" : "/practice?preset=quick"}>
            <IPlay /> {active ? "Resume test" : "Start practice"}
          </Link>
        </section>

        <div className="kpis">
          <div className="kpi">
            <strong className="num">{fmtNum(me.questions)}</strong>
            <span>practised</span>
          </div>
          <div className="kpi">
            <strong className="num">{me.accuracy !== null ? `${me.accuracy}%` : "–"}</strong>
            <span>accuracy</span>
          </div>
          <Link className="kpi" to="/saved?tab=mistakes">
            <strong className="num">{fmtNum(me.toRevise)}</strong>
            <span>to revise</span>
          </Link>
        </div>

        <section className="section">
          <div className="section-head">
            <h2>Practice modes</h2>
          </div>
          <div className="modes">
            {modes.map((m) => (
              <Link key={m.to} className={`mode mode-${m.tone}`} to={m.to}>
                <span className="mode-icon">
                  <m.icon />
                </span>
                <span className="mode-title">{m.title}</span>
                <span className="mode-sub">{m.sub}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Asked most often</h2>
            <Link to="/repeats">See all</Link>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {top.map((g, i) => {
              const q = ds.byId.get(g.canonical)!;
              return (
                <Link key={g.id} className="rank-card" to={`/q/${q.id}`}>
                  <span className="rank num">{i + 1}</span>
                  <span className="li-body">
                    <span className="li-title clamp2">{q.text}</span>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="chip chip-gold">
                        <IFlame /> {g.distinctPapers}× asked
                      </span>
                      <span className="xs muted">{g.years.join(" · ")}</span>
                    </span>
                  </span>
                  <IChevronR className="chev" />
                </Link>
              );
            })}
          </div>
        </section>

        <p className="footnote">
          {fmtNum(t.questions)} questions from {t.papers} real papers (2023–2025). Past repeats don't guarantee future questions.
        </p>
      </div>
    </>
  );
}
