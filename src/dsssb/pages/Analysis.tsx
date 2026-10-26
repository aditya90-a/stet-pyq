import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fmtDate } from "../../lib/format";
import { HBar, Kpi, PageHead, QRow, useNames } from "../components";
import { useLang, useT } from "../i18n";
import { useD } from "../store";

const SUBJECTS = ["General Awareness", "General Intelligence & Reasoning", "Arithmetical & Numerical Ability", "Hindi Language", "English Language", "Computer Science", "Teaching Methodology"];

export function DAnalysis() {
  const { ds } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const [subject, setSubject] = useState("Computer Science");
  const [open, setOpen] = useState<string | null>(null);
  const s = ds.stats;
  const years = Object.keys(s.byYear);
  const topics = s.topics.filter((r) => r.subject === subject);
  const maxT = Math.max(1, ...topics.map((r) => r.questions));
  const maxSubj = Math.max(...Object.values(s.bySubject));
  return (
    <div className="dpage">
      <PageHead
        title={t("analysis")}
        sub={
          lang === "hi"
            ? "सभी आँकड़े निकाले गए वास्तविक प्रश्नों से गिने गए हैं। विषय/प्रकरण वर्गीकरण AI समीक्षा द्वारा किया गया।"
            : "Every number is counted from the extracted questions. Subject/topic labels come from the AI review layer."
        }
      />
      <div className="dkpis">
        <Kpi value={s.totals.questions} label={t("questionsCount")} />
        <Kpi value={s.totals.papers} label={t("papers")} />
        <Kpi value={s.totals.years} label={lang === "hi" ? "वर्ष" : "years"} />
        <Kpi value={s.totals.pages} label={lang === "hi" ? "PDF पृष्ठ" : "PDF pages"} />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>{t("yearWise")}</h2>
        </div>
        <p className="xs muted">{lang === "hi" ? "प्रति प्रश्नपत्र औसत प्रश्न (2021 में 5 सेट हैं)।" : "Average questions per paper (2021 has five sets)."}</p>
        <div className="table-wrap card">
          <table className="dtable">
            <thead>
              <tr>
                <th>{t("subject")}</th>
                {years.map((y) => (
                  <th key={y} className="num">
                    {y}
                    <div className="xs muted">
                      {s.byYear[y].papers.length} {lang === "hi" ? "पत्र" : "paper(s)"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SUBJECTS.map((sub) => (
                <tr key={sub}>
                  <td>{names.subject(sub)}</td>
                  {years.map((y) => (
                    <td key={y} className="num">
                      {s.byYear[y].bySubjectPerPaper[sub] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("paperWise")}</h2>
        </div>
        <div className="table-wrap card">
          <table className="dtable">
            <thead>
              <tr>
                <th>{t("paper")}</th>
                <th>{lang === "hi" ? "तिथि / पाली" : "Date / shift"}</th>
                <th className="num">CS</th>
                <th className="num">{lang === "hi" ? "शिक्षण" : "Teaching"}</th>
                <th className="num">{t("easy")}</th>
                <th className="num">{t("medium")}</th>
                <th className="num">{t("hard")}</th>
                <th className="num">{lang === "hi" ? "हटाए" : "Dropped"}</th>
                <th className="num">{t("disputed")}</th>
              </tr>
            </thead>
            <tbody>
              {ds.papers.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/dsssb/bank?paper=${p.id}`}>{lang === "hi" ? p.labelHi : p.label}</Link>
                    <div className="xs muted">
                      {p.postCode} · {p.departmentShort}
                    </div>
                  </td>
                  <td className="xs">
                    {p.date ? fmtDate(p.date) : lang === "hi" ? "तिथि मुद्रित नहीं" : "date not printed"} · {p.shiftLabel}
                  </td>
                  <td className="num">{p.stats.bySubject["Computer Science"] ?? 0}</td>
                  <td className="num">{p.stats.bySubject["Teaching Methodology"] ?? 0}</td>
                  <td className="num">{p.stats.byDifficulty.easy ?? 0}</td>
                  <td className="num">{p.stats.byDifficulty.medium ?? 0}</td>
                  <td className="num">{p.stats.byDifficulty.hard ?? 0}</td>
                  <td className="num">{p.stats.dropped}</td>
                  <td className="num">{p.stats.byStatus.disputed ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("subjectWise")}</h2>
        </div>
        <div className="card">
          {Object.entries(s.bySubject).map(([k, v]) => (
            <HBar key={k} label={names.subject(k)} value={v} max={maxSubj} sub={v} to={`/dsssb/bank?subject=${encodeURIComponent(k)}`} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("topicWise")}</h2>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={t("subject")}>
            {SUBJECTS.map((x) => (
              <option key={x} value={x}>
                {names.subject(x)}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap card">
          <table className="dtable topics">
            <thead>
              <tr>
                <th>{t("topic")}</th>
                <th className="num">{t("questionsCount")}</th>
                <th className="num">{lang === "hi" ? "पत्रों में" : "In papers"}</th>
                <th className="num">{lang === "hi" ? "प्रति DoE पत्र" : "Per DoE paper"}</th>
                {years.map((y) => (
                  <th key={y} className="num">
                    {y}
                  </th>
                ))}
                <th className="num">{t("sameConcept")}</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((r) => (
                <Fragment key={r.topic}>
                  <tr className="clickable" onClick={() => setOpen(open === r.topic ? null : r.topic)}>
                    <td>
                      <div className="cell-bar">
                        <span>{names.topic(r.subject, r.topic)}</span>
                        <span className="mini" style={{ width: `${(100 * r.questions) / maxT}%` }} />
                      </div>
                    </td>
                    <td className="num">{r.questions}</td>
                    <td className="num">
                      {r.papersAsked}/{s.totals.papers}
                    </td>
                    <td className="num">{r.perDoePaper ?? "–"}</td>
                    {years.map((y) => (
                      <td key={y} className="num">
                        {r.byYear[y] ?? 0}
                      </td>
                    ))}
                    <td className="num">{r.conceptRepeats}</td>
                  </tr>
                  {open === r.topic && (
                    <tr className="sub">
                      <td colSpan={5 + years.length}>
                        {Object.entries(r.bySubtopic).map(([st, n]) => (
                          <HBar key={st} label={st} value={n} max={r.questions} sub={n} />
                        ))}
                        <Link className="xs" to={`/dsssb/bank?topic=${encodeURIComponent(`${r.subject}|${r.topic}`)}`}>
                          {t("bank")} →
                        </Link>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("difficulty")}</h2>
        </div>
        <div className="card">
          {(["easy", "medium", "hard"] as const).map((d) => (
            <HBar key={d} label={t(d)} value={s.byDifficulty[d] ?? 0} max={s.totals.questions} sub={s.byDifficulty[d] ?? 0} />
          ))}
          <p className="xs muted">{lang === "hi" ? "कठिनाई AI समीक्षा द्वारा आँकी गई।" : "Difficulty is an AI-review rating."}</p>
        </div>
      </section>
    </div>
  );
}

export function DRepeats() {
  const { ds } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const [kind, setKind] = useState<"repeat" | "concept">("repeat");
  const groups = useMemo(() => ds.groups[kind].filter((g) => g.distinctPapers > 1 || g.members.length > 1), [ds, kind]);
  const multi = ds.groups.repeat.filter((g) => g.distinctPapers > 1).length;
  return (
    <div className="dpage">
      <PageHead
        title={t("repeats")}
        sub={
          lang === "hi"
            ? "हूबहू और पुनर्लिखित दोहराव, तथा एक ही अवधारणा पर पूछे गए अलग-अलग प्रश्न।"
            : "Exact and reworded repeats, and different questions that test the same concept."
        }
      />
      <div className="notice notice-accent small">
        <div>
          {lang === "hi"
            ? `7 प्रश्नपत्रों में केवल ${multi} प्रश्न-समूह हूबहू/पुनर्लिखित रूप में दोहराए गए; ${ds.groups.concept.length} समूहों में वही अवधारणा अलग शब्दों/आँकड़ों से पूछी गई। अर्थात् DSSSB प्रश्न कम दोहराता है, अवधारणाएँ अधिक।`
            : `Across the 7 papers only ${multi} question groups repeat exactly or reworded, while ${ds.groups.concept.length} groups ask the same concept with different wording or data: DSSSB rarely repeats questions, but often repeats concepts.`}
          <div className="xs muted">
            {lang === "hi"
              ? "विधि: पाठ समानता + विकल्प समानता + प्रश्न-विशिष्ट भाग और चित्रों की तुलना; सीमांत जोड़ों का AI निर्णय।"
              : "Method: wording and option similarity, a check that the question-specific part and any figure also match, and AI adjudication of borderline pairs."}
          </div>
        </div>
      </div>
      <div className="seg" role="group" aria-label="Kind">
        <button aria-pressed={kind === "repeat"} onClick={() => setKind("repeat")}>
          {t("exact")} / {t("paraphrase")} ({ds.groups.repeat.length})
        </button>
        <button aria-pressed={kind === "concept"} onClick={() => setKind("concept")}>
          {t("sameConcept")} ({ds.groups.concept.length})
        </button>
      </div>
      {groups.map((g) => {
        const canon = ds.byId.get(g.canonical)!;
        return (
          <section key={g.id} className="card fam">
            <div className="fam-top">
              <span className="chip chip-flame">
                {g.distinctPapers} {lang === "hi" ? "पत्र" : "papers"}
              </span>
              <span className="chip">{names.topic(g.subject, g.topic)}</span>
              {g.concept && <span className="xs muted">{g.concept}</span>}
            </div>
            <div className="list">
              {g.members.map((m) => {
                const q = ds.byId.get(m)!;
                return <QRow key={m} q={q} right={<span className="chip">{q.answer.label ?? "–"}</span>} />;
              })}
            </div>
            <p className="xs muted">{canon.repeat.matches.find((x) => g.members.includes(x.id))?.reason}</p>
          </section>
        );
      })}
    </div>
  );
}
