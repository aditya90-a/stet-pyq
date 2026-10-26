import { Link } from "react-router-dom";
import { IBook, ICalendar, IChevronR, IFlame, IInfo, IMoon, IPlay, ISun, ITimer } from "../components/Icons";
import { useData } from "../data/store";
import { fmtNum } from "../lib/format";
import { progressSummary } from "../lib/storage";
import { useTheme } from "../lib/theme";

export function Home() {
  const { ds, user } = useData();
  const { effective, toggle } = useTheme();
  const t = ds.stats.totals;
  const me = progressSummary(user);
  const top = ds.groups.repeat.filter((g) => g.distinctPapers > 1).slice(0, 5);
  const active = user.activeTest;

  const actions = [
    { to: "/repeats", icon: IFlame, tint: "tint-flame", title: "Most repeated", sub: `${fmtNum(t.repeatGroups)} questions asked again` },
    { to: "/practice?preset=mock", icon: ITimer, tint: "tint-warning", title: "Full mock test", sub: "150 questions · 150 minutes" },
    { to: "/topics", icon: IBook, tint: "tint-good", title: "Topic-wise", sub: "Practise one unit at a time" },
    { to: "/papers", icon: ICalendar, tint: "tint-accent", title: "Past papers", sub: `${t.papers} papers, 2023–2025` },
  ];

  return (
    <>
      <header className="appbar">
        <div className="appbar-title">
          <h1>STET PYQ</h1>
          <div className="sub">Bihar STET · Computer Science</div>
        </div>
        <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${effective === "dark" ? "light" : "dark"} theme`}>
          {effective === "dark" ? <ISun /> : <IMoon />}
        </button>
        <Link className="icon-btn" to="/about" aria-label="About">
          <IInfo />
        </Link>
      </header>

      <div className="page">
        {active ? (
          <Link className="hero" to="/practice">
            <div className="hero-kicker">Continue</div>
            <div className="hero-title">
              {Object.values(active.responses).filter((v) => v !== null).length} of {active.items.length} answered
            </div>
            <div className="hero-actions">
              <span className="btn btn-white">
                <IPlay /> Resume test
              </span>
            </div>
          </Link>
        ) : (
          <section className="hero">
            <div className="hero-kicker">{fmtNum(t.questions)} real questions</div>
            <div className="hero-title">Practise Bihar STET previous-year questions</div>
            <div className="hero-sub">{me.answers ? `${me.questions} done · ${me.accuracy}% correct` : "With answers and explanations for every question."}</div>
            <div className="hero-actions">
              <Link className="btn btn-white" to="/practice?preset=quick">
                <IPlay /> Start practice
              </Link>
            </div>
          </section>
        )}

        <div className="list">
          {actions.map((a) => (
            <Link key={a.to} className="li" to={a.to}>
              <span className={`li-icon ${a.tint}`}>
                <a.icon />
              </span>
              <div className="li-body">
                <span className="li-title">{a.title}</span>
                <span className="li-sub">{a.sub}</span>
              </div>
              <span className="li-end">
                <IChevronR />
              </span>
            </Link>
          ))}
        </div>

        <section className="section">
          <div className="section-head">
            <h2>Asked most often</h2>
            <Link to="/repeats">See all</Link>
          </div>
          <div className="list">
            {top.map((g) => {
              const q = ds.byId.get(g.canonical)!;
              return (
                <Link key={g.id} className="li" to={`/q/${q.id}`}>
                  <div className="li-body">
                    <span className="li-title clamp2">{q.text}</span>
                    <span className="li-sub">
                      Asked {g.distinctPapers}× · {g.years.join(", ")}
                    </span>
                  </div>
                  <span className="li-end">
                    <IChevronR />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
