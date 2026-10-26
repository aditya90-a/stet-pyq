import { Link, useParams } from "react-router-dom";
import { IChevronR, IFlame, IPlay, ISearch, ITimer } from "../components/Icons";
import { AppBar, Empty, Stat } from "../components/ui";
import { useData } from "../data/store";
import { fmtDate } from "../lib/format";

export function Papers() {
  const { ds } = useData();
  const years = [...new Set(ds.papers.map((p) => p.year))].sort((a, b) => b - a);
  return (
    <>
      <AppBar title="Papers" sub={`${ds.papers.length} papers · ${years.length} exam years`} back fallback="/" />
      <div className="page">
        {years.map((y) => (
          <section key={y} className="section">
            <div className="year-head">
              <span className="year-badge">STET {y}</span>
              <span className="xs muted">{ds.papers.filter((p) => p.year === y).length} shifts</span>
            </div>
            <div className="list">
              {ds.papers
                .filter((p) => p.year === y)
                .sort((a, b) => a.date.localeCompare(b.date) || a.shift - b.shift)
                .map((p) => {
                  const s = ds.stats.papers[p.id];
                  return (
                    <Link key={p.id} className="li" to={`/papers/${p.id}`}>
                      <span className="li-icon tint-accent num" style={{ fontWeight: 800 }}>
                        S{p.shift}
                      </span>
                      <div className="li-body">
                        <span className="li-title">{fmtDate(p.date)}</span>
                        <span className="li-sub">
                          Shift {p.shift} · {s.questions} questions
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
        ))}
      </div>
    </>
  );
}

export function PaperDetail() {
  const { id } = useParams();
  const { ds } = useData();
  const p = id ? ds.paperById.get(id) : undefined;
  if (!p)
    return (
      <>
        <AppBar title="Paper" back fallback="/papers" />
        <Empty title="Paper not found" />
      </>
    );
  const s = ds.stats.papers[p.id];
  return (
    <>
      <AppBar title={fmtDate(p.date)} sub={`STET ${p.year} · Shift ${p.shift}`} back fallback="/papers" />
      <div className="page">
        <div className="stats">
          <Stat value={s.questions} label="questions" />
          <Stat value={s.repeated} label="asked in other papers too" />
          <Stat value={p.timeStart ?? "–"} label="start time" />
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <Link className="btn btn-primary btn-lg btn-block" to={`/practice?preset=paper&paper=${p.id}`}>
            <ITimer /> Attempt full paper
          </Link>
          <Link className="btn btn-block" to={`/practice?paper=${p.id}`}>
            <IPlay /> Practise 20 from this paper
          </Link>
          <Link className="btn btn-block" to={`/explore?paper=${p.id}`}>
            <ISearch /> See all questions
          </Link>
          <Link className="btn btn-soft btn-block" to={`/explore?paper=${p.id}&repeat=repeated`}>
            <IFlame /> Only the {s.repeated} repeated ones
          </Link>
        </div>
      </div>
    </>
  );
}
