import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IChevronD, IChevronR, IPlay } from "../components/Icons";
import { AppBar, Bar } from "../components/ui";
import { useData } from "../data/store";
import { countBy } from "../lib/filters";
import { fmtNum } from "../lib/format";

export function Topics() {
  const { ds } = useData();
  const subjects = Object.keys(ds.stats.bySubject);
  const [subject, setSubject] = useState(subjects[0]);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const qs = ds.questions.filter((q) => q.classification.subject === subject);
    return countBy(qs, (q) => q.classification.topic).map(([topic, n]) => {
      const tq = qs.filter((q) => q.classification.topic === topic);
      return {
        topic,
        n,
        repeated: tq.filter((q) => q.repeat.distinctPapers > 1).length,
        subs: countBy(tq, (q) => q.classification.subtopic).filter(([s]) => s && s !== "Unclassified"),
      };
    });
  }, [ds, subject]);
  const total = rows.reduce((a, r) => a + r.n, 0);
  const max = Math.max(...rows.map((r) => r.n));
  const enc = encodeURIComponent;

  return (
    <>
      <AppBar title="Topics" sub="Where the marks come from, across all papers" back fallback="/" />
      <div className="page" style={{ gap: 14 }}>
        <div className="fchips" role="toolbar" aria-label="Subject">
          {subjects.map((s) => (
            <button
              key={s}
              className="fchip"
              aria-pressed={subject === s}
              onClick={() => {
                setSubject(s);
                setOpen(null);
              }}
            >
              {s} · {ds.stats.bySubject[s]}
            </button>
          ))}
        </div>
        <span className="small muted">
          {fmtNum(total)} questions in {rows.length} topics · biggest first
        </span>
        <div className="list">
          {rows.map((r) => {
            const isOpen = open === r.topic;
            return (
              <div key={r.topic} className="topic">
                <button className="topic-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.topic)}>
                  <div className="li-body">
                    <span className="li-title">{r.topic}</span>
                    <Bar value={r.n} max={max} />
                    <span className="li-sub">
                      {r.n} questions · {Math.round((100 * r.n) / total)}% of {subject}
                      {r.repeated > 0 && ` · ${r.repeated} repeated`}
                    </span>
                  </div>
                  <span className="li-end">{isOpen ? <IChevronD /> : <IChevronR />}</span>
                </button>
                {isOpen && (
                  <>
                    {r.subs.length > 0 && (
                      <div className="topic-sub">
                        {r.subs.map(([s, n]) => (
                          <Link key={s} className="chip" to={`/explore?subject=${enc(subject)}&topic=${enc(r.topic)}&q=${enc(s)}`}>
                            {s} · {n}
                          </Link>
                        ))}
                      </div>
                    )}
                    <div className="row" style={{ marginTop: 4 }}>
                      <Link className="btn btn-sm" to={`/explore?subject=${enc(subject)}&topic=${enc(r.topic)}`}>
                        Browse
                      </Link>
                      <Link className="btn btn-sm btn-primary" to={`/practice?subject=${enc(subject)}&topic=${enc(r.topic)}`}>
                        <IPlay /> Practise
                      </Link>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="xs muted">Topics follow the syllabus units; labels were assigned by AI review and keyword rules, so a few questions may sit in a neighbouring unit.</p>
      </div>
    </>
  );
}
