import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HBar, PageHead, SourceLink, useNames } from "../components";
import { useLang, useT } from "../i18n";
import { useD } from "../store";
import type { SyllabusUnit } from "../types";

function UnitRow({ u, prefix }: { u: SyllabusUnit; prefix: string }) {
  const { lang } = useLang();
  const names = useNames();
  return (
    <li className="unit">
      <div className="unit-head">
        <span className="unit-n">
          {prefix}
          {u.n}
        </span>
        <span className="unit-text">{u.text}</span>
      </div>
      <div className="unit-meta">
        {u.topics.length ? (
          u.topics.map((tp) => (
            <Link key={tp} className="chip chip-accent" to={`/dsssb/bank?topic=${encodeURIComponent(`${prefix ? "Teaching Methodology" : "Computer Science"}|${tp}`)}`}>
              {names.topic(prefix ? "Teaching Methodology" : "Computer Science", tp)}
            </Link>
          ))
        ) : (
          <span className="xs muted">{lang === "hi" ? "कोई मैप किया प्रकरण नहीं" : "no mapped topic"}</span>
        )}
        {u.status !== "ocr-confirmed" && (
          <span className="xs muted" title={lang === "hi" ? "OCR ने यह पढ़ा था; पृष्ठ छवि से ठीक किया गया" : "OCR read this; corrected from the page image"}>
            OCR: “{u.ocr ?? "—"}”
          </span>
        )}
      </div>
    </li>
  );
}

export function DSyllabus() {
  const { ds, user, updateUser } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const syl = ds.exam.syllabus;
  const [open, setOpen] = useState<string | null>("Computer Science");
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of ds.questions) {
      const c = q.classification;
      m.set(`${c.subject}|${c.topic}`, (m.get(`${c.subject}|${c.topic}`) ?? 0) + 1);
      m.set(`${c.subject}|${c.topic}|${c.subtopic}`, (m.get(`${c.subject}|${c.topic}|${c.subtopic}`) ?? 0) + 1);
    }
    return m;
  }, [ds]);
  const toggle = (k: string) =>
    updateUser((s) => {
      const d = { ...s.syllabusDone };
      if (d[k]) delete d[k];
      else d[k] = Date.now();
      return { ...s, syllabusDone: d };
    });
  const subjects = Object.entries(ds.meta.taxonomy);
  return (
    <div className="dpage">
      <PageHead
        title={t("syllabus")}
        sub={
          lang === "hi"
            ? "आधिकारिक इकाइयाँ (DSSSB) और नीचे इस साइट का अध्ययन विभाजन — उप-प्रकरणों को पूर्ण चिह्नित कर प्रगति ट्रैक करें।"
            : "Official units from DSSSB, then this site's study breakdown — tick subtopics to track your progress."
        }
      />

      <section className="section">
        <div className="section-head">
          <h2>{t("officialSyllabus")} · Section B</h2>
        </div>
        <div className="card">
          <p className="small">
            <strong>{syl.title}</strong>
          </p>
          <SourceLink url={syl.url} official title="pc-41-26_tgt_computer_science_in_doe.pdf (DSSSB)" />
          <p className="xs muted">{syl.transcriptionNote}</p>
          <ol className="units">
            {syl.csUnits.map((u) => (
              <UnitRow key={u.n} u={u} prefix="" />
            ))}
          </ol>
          <h3 className="h3">{lang === "hi" ? "शिक्षण शिक्षा एवं पद्धति" : "Teaching Education and Methodology"}</h3>
          <ol className="units">
            {syl.pedagogyUnits.map((u) => (
              <UnitRow key={u.n} u={u} prefix="P" />
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Section A</h2>
        </div>
        <div className="card">
          <SourceLink url={syl.sectionA.url} official title={syl.sectionA.title} />
          {syl.sectionA.parts.map((p) => (
            <div key={p.subject} className="secA">
              <strong>
                {names.subject(p.subject)} · {p.marks}
              </strong>
              <p className="small">{p.text}</p>
            </div>
          ))}
          <p className="xs muted">{syl.sectionA.note}</p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("studyBreakdown")}</h2>
        </div>
        <p className="xs muted">
          {lang === "hi"
            ? "उप-प्रकरण इस साइट द्वारा बनाए गए हैं (आधिकारिक नहीं)। संख्या = 7 प्रश्नपत्रों में पूछे गए प्रश्न।"
            : "Subtopics are this site's breakdown (not official). Numbers = questions asked across the 7 papers."}
        </p>
        {subjects.map(([s, sd]) => {
          const keys = Object.entries(sd.topics).flatMap(([tp, tv]) => tv.subtopics.map((st) => `${s}|${tp}|${st}`));
          const doneN = keys.filter((k) => user.syllabusDone[k]).length;
          const isOpen = open === s;
          return (
            <div key={s} className="card syl-subject">
              <button className="syl-subject-head" onClick={() => setOpen(isOpen ? null : s)} aria-expanded={isOpen}>
                <span>
                  <strong>{names.subject(s)}</strong> <span className="chip">Section {sd.part}</span>
                </span>
                <span className="xs muted">
                  {doneN}/{keys.length} {t("done").toLowerCase()}
                </span>
              </button>
              <HBar label="" value={doneN} max={keys.length} sub="" tone="good" />
              {isOpen &&
                Object.entries(sd.topics).map(([tp, tv]) => (
                  <div key={tp} className="syl-topic">
                    <div className="syl-topic-head">
                      <Link to={`/dsssb/bank?topic=${encodeURIComponent(`${s}|${tp}`)}`}>
                        <strong>{names.topic(s, tp)}</strong>
                      </Link>
                      <span className="xs muted">
                        {counts.get(`${s}|${tp}`) ?? 0} {t("pyqs")}
                        {tv.units?.length ? ` · ${lang === "hi" ? "इकाई" : "unit"} ${tv.units.join(", ")}` : ""}
                        {tv.outside41_26 ? ` · ${lang === "hi" ? "41/26 सूची से बाहर" : "outside the 41/26 list"}` : ""}
                      </span>
                      <Link className="xs" to={`/dsssb/notes/${slugOf(ds.notes, s, tp)}`}>
                        {t("notes")} →
                      </Link>
                    </div>
                    <ul className="syl-subs">
                      {tv.subtopics.map((st) => {
                        const k = `${s}|${tp}|${st}`;
                        return (
                          <li key={st}>
                            <label>
                              <input type="checkbox" checked={!!user.syllabusDone[k]} onChange={() => toggle(k)} />
                              <span>{st}</span>
                              <span className="xs muted">{counts.get(k) ?? 0}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}

export function slugOf(notes: { slug: string; subject: string; topic: string }[], s: string, t: string) {
  return notes.find((n) => n.subject === s && n.topic === t)?.slug ?? "";
}
