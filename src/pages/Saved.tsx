import { useState } from "react";
import { Link } from "react-router-dom";
import { IBookmark, IDownload, IPlay, IRotate, ITrophy, IUpload } from "../components/Icons";
import { MoreList, QuestionRow } from "../components/QuestionRow";
import { AppBar, Empty, Notice, Seg } from "../components/ui";
import { useData } from "../data/store";
import { fmtDuration } from "../lib/format";
import { needsRevision, type UserState } from "../lib/storage";
import { useQueryState } from "../lib/useQueryState";

type Tab = "bookmarks" | "mistakes" | "history";

export function Saved() {
  const { ds, user, updateUser, persistOk } = useData();
  const { state, set } = useQueryState(["tab"] as const);
  const tab = (state.tab as Tab) ?? "bookmarks";
  const [page, setPage] = useState(1);
  const revise = needsRevision(user).filter((id) => ds.byId.has(id));
  const bookmarks = user.bookmarks.filter((id) => ds.byId.has(id));
  const practice = (ids: string[]) => `/practice?ids=${ids.slice(0, 300).join(",")}`;

  const backup = () => {
    const blob = new Blob([JSON.stringify(user)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stet-pyq-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const restore = (file: File) =>
    file.text().then((t) => {
      try {
        const s = JSON.parse(t) as UserState;
        if (!Array.isArray(s.bookmarks) || typeof s.history !== "object") throw new Error("not a progress file");
        updateUser(() => ({ ...s, activeTest: null }));
      } catch (e) {
        window.alert(`Could not import: ${(e as Error).message}`);
      }
    });

  return (
    <>
      <AppBar title="Saved" sub="Bookmarks, mistakes and test history" large />
      <div className="page" style={{ gap: 14 }}>
        <Seg
          label="Section"
          value={tab}
          onChange={(v) => {
            set("tab", v === "bookmarks" ? "" : v);
            setPage(1);
          }}
          options={[
            ["bookmarks", `Saved ${bookmarks.length}`],
            ["mistakes", `Mistakes ${revise.length}`],
            ["history", `Tests ${user.attempts.length}`],
          ]}
        />

        {tab === "bookmarks" &&
          (bookmarks.length ? (
            <>
              <Link className="btn btn-primary btn-block" to={practice(bookmarks)}>
                <IPlay /> Practise saved questions
              </Link>
              <div className="stack" style={{ gap: 10 }}>
                <MoreList items={bookmarks} page={page} setPage={setPage} render={(id) => <QuestionRow key={id} q={ds.byId.get(id)!} showAnswer />} />
              </div>
            </>
          ) : (
            <Empty icon={IBookmark} title="Nothing saved yet">
              <span className="small">Tap the bookmark icon on any question to keep it here for revision.</span>
            </Empty>
          ))}

        {tab === "mistakes" &&
          (revise.length ? (
            <>
              <Link className="btn btn-primary btn-block" to={practice(revise)}>
                <IRotate /> Practise {revise.length} mistakes
              </Link>
              <p className="small muted">Questions you last answered wrong or skipped. Get one right to clear it.</p>
              <div className="stack" style={{ gap: 10 }}>
                <MoreList items={revise} page={page} setPage={setPage} render={(id) => <QuestionRow key={id} q={ds.byId.get(id)!} showAnswer />} />
              </div>
            </>
          ) : (
            <Empty icon={IRotate} title="No mistakes to revise">
              <span className="small">Take a practice test; wrong answers show up here.</span>
            </Empty>
          ))}

        {tab === "history" &&
          (user.attempts.length ? (
            <div className="list">
              {user.attempts.map((a) => (
                <Link key={a.id} className="li" to={practice(a.questionIds)}>
                  <span className="li-icon tint-accent">
                    <ITrophy />
                  </span>
                  <div className="li-body">
                    <span className="li-title">
                      {a.correct}/{a.total} correct · {a.mode === "mock" ? "Mock" : "Practice"}
                    </span>
                    <span className="li-sub">
                      {new Date(a.finishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {fmtDuration(a.elapsedSec)} · tap to retake
                    </span>
                  </div>
                  <span className="li-end num">{Math.round(a.scorePct)}%</span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty icon={ITrophy} title="No tests yet">
              <Link className="btn btn-primary" to="/practice">
                Start practising
              </Link>
            </Empty>
          ))}

        <Notice tone={persistOk ? "neutral" : "warning"}>
          {persistOk
            ? "Progress is stored on this device only. Back it up to move it to another phone or browser."
            : "This browser is blocking storage (private mode?). Progress will be lost when you close the tab."}
        </Notice>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <button className="btn btn-block" onClick={backup}>
            <IDownload /> Back up
          </button>
          <label className="btn btn-block">
            <IUpload /> Restore
            <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          </label>
        </div>
      </div>
    </>
  );
}
