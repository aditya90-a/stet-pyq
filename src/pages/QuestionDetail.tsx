import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IBookmark, IChevronL, IChevronR } from "../components/Icons";
import { useImmersive } from "../components/Layout";
import { QuestionView } from "../components/QuestionView";
import { AppBar, Empty, useToast } from "../components/ui";
import { useData } from "../data/store";
import { neighbours } from "../lib/questionNav";
import { toggleBookmark } from "../lib/storage";

export function QuestionDetail() {
  const { id } = useParams();
  const { ds, user, updateUser } = useData();
  const nav = useNavigate();
  const [toast, show] = useToast();
  const touch = useRef<{ x: number; y: number } | null>(null);
  useImmersive(true);
  const q = id ? ds.byId.get(id) : undefined;

  const near = useMemo(() => {
    if (!q) return null;
    const paper = ds.paperById.get(q.paperId)!;
    const ids = ds.questions.filter((x) => x.paperId === q.paperId).map((x) => x.id);
    return neighbours(q.id, { ids, label: paper.shortLabel });
  }, [ds, q]);
  const go = (to: string | null) => to && nav(`/q/${to}`, { replace: true });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(near?.next ?? null);
      if (e.key === "ArrowLeft") go(near?.prev ?? null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!q || !near)
    return (
      <>
        <AppBar title="Question" back fallback="/explore" />
        <Empty title="Question not found">
          <span className="small">The link may be from an older version of the data.</span>
        </Empty>
      </>
    );
  const saved = user.bookmarks.includes(q.id);

  return (
    <>
      <AppBar
        title={`Question ${near.pos} of ${near.total}`}
        sub={near.label}
        back
        fallback="/explore"
        actions={
          <button
            className={`icon-btn ${saved ? "on" : ""}`}
            aria-pressed={saved}
            aria-label={saved ? "Remove bookmark" : "Bookmark"}
            onClick={() => {
              updateUser((s) => toggleBookmark(s, q.id));
              show(saved ? "Removed from saved" : "Saved for revision");
            }}
          >
            <IBookmark />
          </button>
        }
      />
      <div className="bar progress-top" aria-hidden="true">
        <span style={{ width: `${(100 * near.pos) / near.total}%` }} />
      </div>
      <div
        className="page"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          if (Math.abs(dx) > 70 && Math.abs(dy) < 50) go(dx < 0 ? near.next : near.prev);
          touch.current = null;
        }}
      >
        {/* key resets the attempt state when moving to another question */}
        <QuestionView key={q.id} q={q} />
      </div>
      <nav className="runfoot" aria-label="Question navigation">
        <button className="btn btn-nav" onClick={() => go(near.prev)} disabled={!near.prev}>
          <IChevronL /> Prev
        </button>
        <span className="runfoot-pos num">
          {near.pos}/{near.total}
        </span>
        <button className="btn btn-primary btn-nav" onClick={() => go(near.next)} disabled={!near.next}>
          Next <IChevronR />
        </button>
      </nav>
      {toast}
    </>
  );
}
