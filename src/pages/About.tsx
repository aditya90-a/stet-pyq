import { AppBar, Section, Seg } from "../components/ui";
import { useData } from "../data/store";
import { ANSWER_STATUS, fmtNum } from "../lib/format";
import { useTheme } from "../lib/theme";

export function About() {
  const { ds, updateUser } = useData();
  const { theme, setTheme } = useTheme();
  const t = ds.stats.totals;
  const st = ds.stats.answerStatus;
  return (
    <>
      <AppBar title="About" back fallback="/" />
      <div className="page">
        <Section title="Appearance">
          <Seg
            label="Theme"
            value={theme ?? "system"}
            onChange={(v) => setTheme(v === "system" ? null : v)}
            options={[
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ]}
          />
        </Section>

        <Section title="Where the questions come from">
          <div className="card stack small" style={{ gap: 10, color: "var(--ink-2)" }}>
            <p>
              Every question was extracted from {t.pdfsProcessed} Bihar STET Computer Science (Paper II, Class 11–12) papers: {t.papers} shifts across {t.years} exam years, {fmtNum(t.questions)} questions in all. Nothing is
              invented: no year, shift, option or answer was guessed.
            </p>
            <p>
              <strong>Answers</strong> are the key printed or marked in each source paper (BSEB question papers and published response sheets) — not an official BSEB final key. Each key was independently re-checked:
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(["verified", "disputed", "ambiguous"] as const).map((k) => (
                <li key={k}>
                  <strong>{ANSWER_STATUS[k].label}</strong> ({fmtNum(st[k] ?? 0)}): {ANSWER_STATUS[k].help}
                </li>
              ))}
            </ul>
            <p>
              <strong>Explanations, topic and difficulty labels</strong> were written by AI review and are labelled as such. Check your textbook when a key is marked disputed.
            </p>
            <p>
              <strong>Repeats</strong> count distinct papers: a question is “asked 3×” only if it appears in three different papers, identically or reworded. Sharing a topic is not a repeat. Past repeats do not predict
              future papers.
            </p>
            <p>
              Some Hindi text was stored in scrambled order in the source PDFs and was repaired automatically; a few image-only questions were transcribed by hand and are marked “Transcribed”.
            </p>
          </div>
        </Section>

        <Section title="Your data">
          <div className="card stack small" style={{ gap: 10, color: "var(--ink-2)" }}>
            <p>No account, no tracking. Bookmarks, mistakes and results stay on this device. Use Saved → Back up to copy them elsewhere.</p>
            <button
              className="btn btn-danger"
              onClick={() => window.confirm("Delete all bookmarks, mistakes and test history on this device?") && updateUser(() => ({ bookmarks: [], lists: [], attempts: [], history: {}, activeTest: null }))}
            >
              Reset my progress
            </button>
          </div>
        </Section>
        <p className="xs muted" style={{ textAlign: "center" }}>
          Data built {new Date(ds.meta.generatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} · pipeline v{ds.meta.pipelineVersion}
        </p>
      </div>
    </>
  );
}
