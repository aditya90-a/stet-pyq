import { useParams } from "react-router-dom";
import { IBookmark } from "../components/Icons";
import { QuestionView } from "../components/QuestionView";
import { AppBar, Empty, useToast } from "../components/ui";
import { useData } from "../data/store";
import { toggleBookmark } from "../lib/storage";

export function QuestionDetail() {
  const { id } = useParams();
  const { ds, user, updateUser } = useData();
  const [toast, show] = useToast();
  const q = id ? ds.byId.get(id) : undefined;
  if (!q)
    return (
      <>
        <AppBar title="Question" back fallback="/explore" />
        <Empty title="Question not found">
          <span className="small">The link may be from an older version of the data.</span>
        </Empty>
      </>
    );
  const p = ds.paperById.get(q.paperId)!;
  const saved = user.bookmarks.includes(q.id);
  return (
    <>
      <AppBar
        title={`Question ${q.qno}`}
        sub={p.label}
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
      <div className="page">
        {/* key resets the attempt state when moving between questions of a family */}
        <QuestionView key={q.id} q={q} />
      </div>
      {toast}
    </>
  );
}
