import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IFlame, IPlay, ISearch, IX } from "../components/Icons";
import { MoreList } from "../components/QuestionRow";
import { AppBar, Empty, Seg } from "../components/ui";
import { useData } from "../data/store";
import type { Dataset, Group } from "../data/types";
import { fmtNum } from "../lib/format";
import { matchesQuery, queryTerms } from "../lib/search";

export type FamilyKind = "exact" | "paraphrase";

/** A repeat family is "exact" when all members are identical copies; otherwise it contains a paraphrase. */
export function familyKind(ds: Dataset, g: Group): FamilyKind {
  const ex = new Set(g.members.map((m) => ds.byId.get(m)!.repeat.exactGroup));
  return ex.size === 1 && !ex.has(null) ? "exact" : "paraphrase";
}

function Family({ g, rank }: { g: Group; rank: number }) {
  const { ds } = useData();
  const q = ds.byId.get(g.canonical)!;
  const k = q.answer.index;
  return (
    <article className="fam">
      <div className="fam-top">
        <span className="fam-rank">#{rank}</span>
        <span className="fam-count">
          <IFlame /> Asked {g.distinctPapers}×
        </span>
        {familyKind(ds, g) === "paraphrase" && (
          <span className="chip" title="At least one appearance is reworded">
            reworded
          </span>
        )}
        <span className="spacer" />
      </div>
      <Link className="fam-text" to={`/q/${q.id}`}>
        {q.text}
      </Link>
      {k !== null && (
        <div className="qrow-ans">
          <strong>{"ABCD"[k]}.</strong> {q.options[k].text}
        </div>
      )}
      <div className="fam-papers">
        {g.members.map((m) => {
          const mq = ds.byId.get(m)!;
          return (
            <Link key={m} className="fam-paper" to={`/q/${m}`}>
              {ds.paperById.get(mq.paperId)!.shortLabel}
            </Link>
          );
        })}
      </div>
    </article>
  );
}

export function Repeats() {
  const { ds } = useData();
  const [spread, setSpread] = useState<"all" | "3" | "years">("all");
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const all = useMemo(() => ds.groups.repeat.filter((g) => g.distinctPapers > 1), [ds]);
  const list = useMemo(() => {
    const terms = queryTerms(text);
    return all.filter((g) => {
      if (spread === "3" && g.distinctPapers < 3) return false;
      if (spread === "years" && g.distinctSessions < 2) return false;
      if (terms.length && !g.members.some((m) => matchesQuery(ds.haystack.get(m) ?? "", terms))) return false;
      return true;
    });
  }, [all, ds, spread, text]);
  const threePlus = all.filter((g) => g.distinctPapers >= 3).length;
  const practice = "/practice?preset=repeated";

  return (
    <>
      <AppBar title="Most repeated" sub={`${fmtNum(all.length)} questions asked in 2+ papers`} back fallback="/" />
      <div className="page" style={{ gap: 14 }}>
        <Link className="btn btn-primary btn-lg btn-block" to={practice}>
          <IPlay /> Practise these
        </Link>

        <div className="search">
          <ISearch />
          <label className="sr-only" htmlFor="rsearch">
            Search repeated questions
          </label>
          <input
            id="rsearch"
            type="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPage(1);
            }}
            placeholder="Search repeated questions"
          />
          {text && (
            <button type="button" className="clear" aria-label="Clear search" onClick={() => setText("")}>
              <IX width={18} height={18} />
            </button>
          )}
        </div>

        <Seg
          label="How often"
          value={spread}
          onChange={(v) => {
            setSpread(v);
            setPage(1);
          }}
          options={[
            ["all", "All"],
            ["3", `3+ times · ${threePlus}`],
            ["years", "Across years"],
          ]}
        />
        {list.length ? (
          <div className="stack" style={{ gap: 10 }}>
            <MoreList items={list} page={page} setPage={setPage} render={(g) => <Family key={g.id} g={g} rank={all.indexOf(g) + 1} />} />
          </div>
        ) : (
          <Empty icon={IFlame} title="Nothing matches" />
        )}
      </div>
    </>
  );
}
