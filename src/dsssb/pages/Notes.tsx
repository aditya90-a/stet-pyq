import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { IBook, ICheck, IChevronR } from "../../components/Icons";
import { Md } from "../../components/ui";
import { PageHead, QRow, useNames } from "../components";
import { useLang, useT } from "../i18n";
import { useD, useNote } from "../store";
import { reviewDue, REVIEW_DAYS, studyTopic } from "../state";
import type { NoteSection } from "../types";

export function DNotesIndex() {
  const { ds, user } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const bySubject = useMemo(() => {
    const m = new Map<string, typeof ds.notes>();
    for (const n of ds.notes) m.set(n.subject, [...(m.get(n.subject) ?? []), n]);
    return [...m.entries()];
  }, [ds]);
  return (
    <div className="dpage">
      <PageHead
        title={t("studyNotes")}
        sub={
          lang === "hi"
            ? "मूल से उन्नत तक: परिभाषाएँ, सूत्र, कोड, आरेख, हल किए उदाहरण, फ़्लैशकार्ड। हर प्रकरण वास्तविक PYQ से जुड़ा है।"
            : "Basics to advanced: definitions, formulas, code, diagrams, worked examples and flashcards. Each topic links to its real PYQs."
        }
      />
      <p className="xs muted">
        {lang === "hi"
          ? "नोट्स AI सहायता से लिखे गए हैं और परीक्षा-केंद्रित हैं; संदेह होने पर मानक पाठ्यपुस्तक देखें।"
          : "Notes were written with AI assistance and are exam-focused; check doubtful points against a standard textbook."}
      </p>
      {bySubject.map(([s, ns]) => (
        <section key={s} className="section">
          <div className="section-head">
            <h2>{names.subject(s)}</h2>
          </div>
          <div className="list card">
            {ns.map((n) => {
              const key = `${n.subject}|${n.topic}`;
              const rv = user.topicReviews[key];
              return n.available ? (
                <Link key={n.slug} className="li" to={`/dsssb/notes/${n.slug}`}>
                  <span className={`li-icon ${user.notesRead[n.slug] ? "tint-good" : "tint-accent"}`}>{user.notesRead[n.slug] ? <ICheck /> : <IBook />}</span>
                  <div className="li-body">
                    <span className="li-title">{lang === "hi" ? n.titleHi ?? n.topicHi : n.topic}</span>
                    <span className="li-sub">
                      {n.sections} {lang === "hi" ? "खंड" : "sections"} · {n.flashcards} {t("flashcards").toLowerCase()} · {n.pyqCount} {t("pyqs")}
                      {n.outside41_26 ? ` · ${lang === "hi" ? "41/26 सूची से बाहर" : "outside 41/26 list"}` : ""}
                      {rv && reviewDue(rv) ? ` · ${lang === "hi" ? "पुनरावृत्ति बाकी" : "revision due"}` : ""}
                    </span>
                  </div>
                  <IChevronR className="chev" />
                </Link>
              ) : (
                <div key={n.slug} className="li disabled">
                  <span className="li-icon">
                    <IBook />
                  </span>
                  <div className="li-body">
                    <span className="li-title">{lang === "hi" ? n.topicHi : n.topic}</span>
                    <span className="li-sub">{lang === "hi" ? "नोट्स तैयार हो रहे हैं" : "Notes not available yet"} · {n.pyqCount} {t("pyqs")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Section({ s }: { s: NoteSection }) {
  return (
    <section className={`note-sec lvl-${s.level}`}>
      <div className="note-sec-head">
        <h3>{s.heading}</h3>
        <span className={`chip lvl lvl-${s.level}`}>{s.level}</span>
      </div>
      {s.body && <Md text={s.body} />}
      {s.table && (
        <div className="table-wrap">
          <table className="dtable">
            <thead>
              <tr>
                {s.table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.code && (
        <figure className="code">
          <figcaption>{s.code.lang}</figcaption>
          <pre>
            <code>{s.code.source}</code>
          </pre>
          {s.code.output && (
            <>
              <figcaption>Output</figcaption>
              <pre className="out">{s.code.output}</pre>
            </>
          )}
        </figure>
      )}
      {s.diagram && (
        <figure className="diagram">
          {s.diagram.title && <figcaption>{s.diagram.title}</figcaption>}
          <pre>{s.diagram.ascii}</pre>
        </figure>
      )}
    </section>
  );
}

export function DNoteDetail() {
  const { slug } = useParams();
  const { ds, user, updateUser } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const { note, error } = useNote(slug);
  const entry = ds.notes.find((n) => n.slug === slug);
  const pyqs = useMemo(
    () => (entry ? ds.questions.filter((q) => q.classification.subject === entry.subject && q.classification.topic === entry.topic) : []),
    [ds, entry],
  );
  if (!entry) return <div className="dpage">Not found</div>;
  if (error) return <div className="dpage notice notice-critical">{error}</div>;
  if (!note) return <div className="dpage muted">{t("loading")}</div>;
  const key = `${entry.subject}|${entry.topic}`;
  const rv = user.topicReviews[key];
  const markStudied = () =>
    updateUser((s) => ({ ...studyTopic(s, key), notesRead: { ...s.notesRead, [entry.slug]: Date.now() } }));
  const levels = ["basic", "intermediate", "advanced"] as const;
  const hiNote = entry.slug.startsWith("hindi-");
  return (
    <div className={`dpage note ${hiNote ? "hi" : ""}`} lang={hiNote ? "hi" : "en"}>
      <PageHead
        title={lang === "hi" ? note.titleHi ?? entry.topicHi : note.topic}
        sub={names.subject(entry.subject)}
        actions={
          <button className="btn btn-primary btn-sm" onClick={markStudied}>
            <ICheck /> {rv ? (lang === "hi" ? "फिर पढ़ा" : "Studied again") : lang === "hi" ? "पढ़ लिया" : "Mark studied"}
          </button>
        }
      />
      {rv && (
        <p className="xs muted">
          {lang === "hi" ? "अगली पुनरावृत्ति" : "Next revision"}: {new Date(rv.last + REVIEW_DAYS[rv.stage] * 86400000).toLocaleDateString()}
        </p>
      )}
      <p className="lead">{note.summary}</p>
      <nav className="note-toc card" aria-label="Contents">
        {note.sections.map((s, i) => (
          <a key={i} href={`#s${i}`} onClick={(e) => { e.preventDefault(); document.getElementById(`s${i}`)?.scrollIntoView({ behavior: "smooth" }); }}>
            {s.heading}
          </a>
        ))}
      </nav>
      {levels.map((lv) => {
        const secs = note.sections.map((s, i) => [s, i] as const).filter(([s]) => s.level === lv);
        return secs.length ? (
          <div key={lv}>
            {secs.map(([s, i]) => (
              <div key={i} id={`s${i}`}>
                <Section s={s} />
              </div>
            ))}
          </div>
        ) : null;
      })}
      {!!note.formulas?.length && (
        <section className="note-sec">
          <h3>{t("formulas")}</h3>
          <div className="formulas">
            {note.formulas.map((f, i) => (
              <div key={i} className="formula">
                <span className="formula-name">{f.name}</span>
                <code>{f.formula}</code>
                {f.note && <span className="xs muted">{f.note}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
      {!!note.workedExamples?.length && (
        <section className="note-sec">
          <h3>{t("workedExamples")}</h3>
          {note.workedExamples.map((w, i) => (
            <details key={i} className="worked">
              <summary>
                <Md text={w.problem} />
              </summary>
              <Md text={w.solution} />
            </details>
          ))}
        </section>
      )}
      {!!note.pitfalls?.length && (
        <section className="note-sec">
          <h3>{t("pitfalls")}</h3>
          <ul>
            {note.pitfalls.map((p, i) => (
              <li key={i}>
                <Md text={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!note.quickRevision?.length && (
        <section className="note-sec quick">
          <h3>{t("quickNotes")}</h3>
          <ul>
            {note.quickRevision.map((p, i) => (
              <li key={i}>
                <Md text={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!note.flashcards?.length && (
        <section className="note-sec">
          <div className="section-head">
            <h3>{t("flashcards")}</h3>
            <Link to={`/dsssb/revise?tab=cards&deck=${entry.slug}`} className="btn btn-soft btn-sm">
              {lang === "hi" ? "अभ्यास करें" : "Practise"} ({note.flashcards.length})
            </Link>
          </div>
        </section>
      )}
      {!!note.glossary?.length && (
        <section className="note-sec">
          <h3>{t("glossary")}</h3>
          <div className="glossary">
            {note.glossary.map((g, i) => (
              <div key={i}>
                <span>{g.en}</span>
                <span lang="hi">{g.hi}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="section">
        <div className="section-head">
          <h2>
            {t("pyqs")} ({pyqs.length})
          </h2>
          <Link className="xs" to={`/dsssb/bank?topic=${encodeURIComponent(key)}`}>
            {lang === "hi" ? "सभी देखें" : "See all"} →
          </Link>
        </div>
        <div className="list card">
          {pyqs.slice(0, 8).map((q) => (
            <QRow key={q.id} q={q} />
          ))}
          {!pyqs.length && <p className="muted small">{lang === "hi" ? "इस प्रकरण से कोई PYQ नहीं" : "No past questions on this topic yet."}</p>}
        </div>
      </section>
    </div>
  );
}
