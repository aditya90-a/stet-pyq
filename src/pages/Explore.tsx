import { useEffect, useMemo, useState } from "react";
import { IFilter, ISearch, IX } from "../components/Icons";
import { MoreList, QuestionRow } from "../components/QuestionRow";
import { AppBar, Choices, Empty, Seg, Sheet } from "../components/ui";
import { useData } from "../data/store";
import { filterQuestions, sortQuestions, type QuestionFilter } from "../lib/filters";
import { fmtNum } from "../lib/format";
import { useQueryState } from "../lib/useQueryState";

const KEYS = ["q", "subject", "topic", "year", "paper", "repeat"] as const;

export function Explore() {
  const { ds } = useData();
  const { state, set, setMany } = useQueryState(KEYS);
  const [text, setText] = useState(state.q ?? "");
  const [sheet, setSheet] = useState(false);
  const [page, setPage] = useState(1);

  // debounce typing into the URL
  useEffect(() => {
    const t = setTimeout(() => text !== (state.q ?? "") && set("q", text.trim()), 250);
    return () => clearTimeout(t);
  }, [text, state.q, set]);
  useEffect(() => setPage(1), [state]);

  const f: QuestionFilter = state;
  const results = useMemo(() => sortQuestions(ds, filterQuestions(ds, f), f.repeat ? "repeats" : "paper"), [ds, f]);

  const subjects = Object.keys(ds.stats.bySubject);
  const topics = [...new Set(ds.questions.filter((q) => !state.subject || q.classification.subject === state.subject).map((q) => q.classification.topic))].sort();
  const years = [...new Set(ds.papers.map((p) => String(p.year)))].sort();
  const nFilters = [state.subject, state.topic, state.year, state.paper].filter(Boolean).length;
  const one = (v: string | undefined) => (v ? [v] : []);

  return (
    <>
      <AppBar title="Questions" large />
      <div className="page" style={{ gap: 12 }}>
        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            set("q", text.trim());
            (document.activeElement as HTMLElement)?.blur();
          }}
        >
          <ISearch />
          <label className="sr-only" htmlFor="qsearch">
            Search questions
          </label>
          <input id="qsearch" type="search" enterKeyHint="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search in English or हिन्दी" />
          {text && (
            <button
              type="button"
              className="clear"
              aria-label="Clear search"
              onClick={() => {
                setText("");
                set("q", "");
              }}
            >
              <IX width={18} height={18} />
            </button>
          )}
        </form>

        <div className="row" style={{ flexWrap: "nowrap" }}>
          <div style={{ flex: 1 }}>
            <Seg
              label="Show"
              value={state.repeat === "repeated" ? "repeated" : "all"}
              onChange={(v) => set("repeat", v === "all" ? "" : v)}
              options={[
                ["all", "All"],
                ["repeated", "Repeated"],
              ]}
            />
          </div>
          <button className="btn" aria-pressed={nFilters > 0} onClick={() => setSheet(true)} style={nFilters ? { borderColor: "var(--accent)", color: "var(--accent-text)" } : undefined}>
            <IFilter /> Filter{nFilters ? ` · ${nFilters}` : ""}
          </button>
        </div>

        <span className="small muted">{fmtNum(results.length)} questions</span>

        {results.length ? (
          <div className="stack" style={{ gap: 10 }}>
            <MoreList items={results} page={page} setPage={setPage} render={(q) => <QuestionRow key={q.id} q={q} />} />
          </div>
        ) : (
          <Empty icon={IFilter} title="No questions match">
            <span className="small">Try other words or clear the filters.</span>
          </Empty>
        )}
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter"
        footer={
          <>
            <button
              className="btn"
              onClick={() => {
                setMany({ subject: "", topic: "", year: "", paper: "" });
                setSheet(false);
              }}
            >
              Clear
            </button>
            <button className="btn btn-primary" onClick={() => setSheet(false)}>
              Show {fmtNum(results.length)}
            </button>
          </>
        }
      >
        <Choices label="Subject" multi={false} options={subjects.map((s) => [s, s])} value={one(state.subject)} onChange={(v) => setMany({ subject: v[0] ?? "", topic: "" })} />
        <Choices label="Topic" multi={false} options={topics.map((s) => [s, s])} value={one(state.topic)} onChange={(v) => set("topic", v[0] ?? "")} />
        <Choices label="Year" multi={false} options={years.map((y) => [y, y])} value={one(state.year)} onChange={(v) => set("year", v[0] ?? "")} />
        <Choices
          label="Paper"
          multi={false}
          options={[...ds.papers].sort((a, b) => a.date.localeCompare(b.date)).map((p) => [p.id, p.shortLabel])}
          value={one(state.paper)}
          onChange={(v) => set("paper", v[0] ?? "")}
        />
      </Sheet>
    </>
  );
}
