import { Link } from "react-router-dom";
import { useData } from "../data/store";
import type { Question } from "../data/types";
import { ICheck } from "./Icons";
import { RepeatBadge } from "./ui";

/** Compact tappable question summary used in every list. */
export function QuestionRow({ q, showAnswer = false, extra }: { q: Question; showAnswer?: boolean; extra?: React.ReactNode }) {
  const { ds } = useData();
  const p = ds.paperById.get(q.paperId)!;
  const key = q.answer.index;
  return (
    <Link className="qrow" to={`/q/${q.id}`}>
      <div className="qrow-meta">
        <span className="chip chip-accent">
          {p.shortLabel} · Q{q.qno}
        </span>
        <RepeatBadge papers={q.repeat.distinctPapers} />
        {extra}
      </div>
      <div className="qrow-text">{q.text || q.textHi}</div>
      {showAnswer && key !== null && (
        <div className="qrow-ans">
          <ICheck />
          <span>
            <strong>{"ABCD"[key]}.</strong> {q.options[key].text}
          </span>
        </div>
      )}
    </Link>
  );
}

/** Renders `items` in pages of `step` with a "Show more" button (cheaper than a pager on phones). */
export function MoreList<T>({ items, step = 20, render, page, setPage }: { items: T[]; step?: number; render: (t: T) => React.ReactNode; page: number; setPage: (n: number) => void }) {
  const shown = items.slice(0, page * step);
  return (
    <>
      {shown.map(render)}
      {shown.length < items.length && (
        <button className="btn btn-block" onClick={() => setPage(page + 1)}>
          Show more ({items.length - shown.length} left)
        </button>
      )}
    </>
  );
}
