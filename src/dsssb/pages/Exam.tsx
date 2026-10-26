import { Link } from "react-router-dom";
import { fmtDate } from "../../lib/format";
import { PageHead, SourceLink } from "../components";
import { useLang, useT } from "../i18n";
import { useD } from "../store";
import type { Fact } from "../types";

const LABELS: Record<string, [string, string]> = {
  advt_41_26: ["Advertisement", "विज्ञापन"],
  vacancies_41_26: ["Vacancies", "रिक्तियाँ"],
  pay_41_26: ["Pay", "वेतन"],
  age_41_26: ["Age limit", "आयु सीमा"],
  qualification_41_26: ["Essential qualification", "आवश्यक योग्यता"],
  application_dates_41_26: ["Application dates", "आवेदन तिथियाँ"],
  fee_41_26: ["Fee", "शुल्क"],
  exam_scheme_41_26: ["Exam scheme", "परीक्षा योजना"],
  qualifying_marks_41_26: ["Qualifying marks", "न्यूनतम अर्हक अंक"],
  exam_dates_41_26: ["Exam dates", "परीक्षा तिथियाँ"],
  tgt_scheme_2017_notice: ["TGT scheme notice (2017)", "TGT योजना सूचना (2017)"],
  generic_ITT_scheme_2021_2023: ["One-tier scheme (2021–2023)", "एक-स्तरीय योजना (2021–2023)"],
  historical_192_14: ["Post code 192/14", "पोस्ट कोड 192/14"],
  historical_91_20: ["Post code 91/20", "पोस्ट कोड 91/20"],
};

function FactCard({ f }: { f: Fact }) {
  const { lang } = useLang();
  const l = LABELS[f.key] ?? [f.key, f.key];
  return (
    <div className="fact">
      <div className="fact-head">
        <h3>{lang === "hi" ? l[1] : l[0]}</h3>
        <span className={`chip ${f.confidence === "confirmed" ? "tone-good" : "tone-warning"}`}>{f.confidence}</span>
      </div>
      <p>{f.value}</p>
      {f.note && <p className="xs muted">{f.note}</p>}
      <SourceLink url={f.sourceUrl} official={f.official} title={f.sourceTitle} />
    </div>
  );
}

export function DExam() {
  const { ds } = useD();
  const { lang } = useLang();
  const t = useT();
  const e = ds.exam;
  const p = e.pattern;
  const find = (k: string) => e.current.find((f) => f.key === k);
  const eligibility = ["age_41_26", "qualification_41_26", "fee_41_26", "application_dates_41_26"].map(find).filter(Boolean) as Fact[];
  const overview = ["advt_41_26", "vacancies_41_26", "pay_41_26", "exam_dates_41_26"].map(find).filter(Boolean) as Fact[];
  const marking = ["exam_scheme_41_26", "qualifying_marks_41_26"].map(find).filter(Boolean) as Fact[];
  return (
    <div className="dpage">
      <PageHead
        title={t("exam")}
        sub={
          lang === "hi"
            ? `आधिकारिक DSSSB दस्तावेज़ों से संकलित (जाँचा गया ${fmtDate(e.researchedOn.slice(0, 10))})। हर तथ्य के साथ स्रोत दिया है।`
            : `Compiled from official DSSSB documents (checked ${fmtDate(e.researchedOn.slice(0, 10))}). Every fact links to its source.`
        }
      />

      <section className="section">
        <div className="section-head">
          <h2>{t("current")} · TGT Computer Science (DoE) · 41/26</h2>
        </div>
        <div className="fact-grid">{overview.map((f) => <FactCard key={f.key} f={f} />)}</div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("pattern")}</h2>
        </div>
        <div className="card">
          <p className="small">
            {p.name}. {p.durationMinutes} {t("minutes")}, {p.totalQuestions} MCQ, {p.totalMarks} {lang === "hi" ? "अंक" : "marks"}, +{p.markPerQuestion} / −{p.negativeMarking}. {p.language}.
          </p>
          <div className="table-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>{lang === "hi" ? "खंड" : "Section"}</th>
                  <th>{t("subject")}</th>
                  <th className="num">{t("questionsCount")}</th>
                  <th className="num">{lang === "hi" ? "अंक" : "Marks"}</th>
                </tr>
              </thead>
              <tbody>
                {p.sections.map((s) => (
                  <tr key={s.name}>
                    <td>{s.section}</td>
                    <td>{s.name}</td>
                    <td className="num">{s.questions}</td>
                    <td className="num">{s.marks}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={2}>{lang === "hi" ? "कुल" : "Total"}</td>
                  <td className="num">{p.totalQuestions}</td>
                  <td className="num">{p.totalMarks}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <h3 className="h3">{t("marking")}</h3>
          <p className="small">{p.qualifyingRule2026}</p>
          <ul className="small">
            {p.changesVsOlderRules.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="src-list">
            {p.sources.map((s) => (
              <SourceLink key={s.url} url={s.url} official={s.official} title={s.title} />
            ))}
          </div>
        </div>
        <div className="fact-grid">{marking.map((f) => <FactCard key={f.key} f={f} />)}</div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("eligibility")}</h2>
        </div>
        <div className="fact-grid">{eligibility.map((f) => <FactCard key={f.key} f={f} />)}</div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("historical")}</h2>
        </div>
        <p className="xs muted">
          {lang === "hi"
            ? "पुराने पोस्ट कोड केवल संदर्भ के लिए हैं; वर्तमान नियम ऊपर 41/26 के हैं।"
            : "Past post codes are context only; the rules that apply now are the 41/26 rules above."}
        </p>
        <div className="table-wrap card">
          <table className="dtable">
            <thead>
              <tr>
                <th>{lang === "hi" ? "पोस्ट कोड" : "Post code"}</th>
                <th>{lang === "hi" ? "विज्ञापन" : "Advt"}</th>
                <th>{lang === "hi" ? "विभाग" : "Department"}</th>
                <th>{lang === "hi" ? "परीक्षा" : "Exam"}</th>
                <th>{lang === "hi" ? "उत्तर कुंजी" : "Answer keys"}</th>
                <th>{t("sources")}</th>
              </tr>
            </thead>
            <tbody>
              {e.postCodes.map((pc) => (
                <tr key={pc.postCode} className={pc.postCode === "41/26" ? "hl" : ""}>
                  <td>
                    <strong>{pc.postCode}</strong>
                    {pc.postCode === "41/26" && <span className="chip tone-accent">{lang === "hi" ? "वर्तमान" : "current"}</span>}
                  </td>
                  <td>{pc.advt}</td>
                  <td>{pc.department}</td>
                  <td>{pc.examDates.join("; ")}</td>
                  <td className="xs">{pc.answerKeyPublished}</td>
                  <td>
                    {pc.sources.map((u, i) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="xs">
                        [{i + 1}]{" "}
                      </a>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fact-grid">{e.historyFacts.map((f) => <FactCard key={f.key} f={f} />)}</div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{lang === "hi" ? "इस साइट के प्रश्नपत्र" : "Papers in this app"}</h2>
        </div>
        <div className="table-wrap card">
          <table className="dtable">
            <thead>
              <tr>
                <th>{t("paper")}</th>
                <th>{lang === "hi" ? "पोस्ट कोड" : "Post code"}</th>
                <th>{lang === "hi" ? "तिथि" : "Date"}</th>
                <th>{t("shift")}</th>
                <th>{lang === "hi" ? "उत्तर कुंजी" : "Key"}</th>
              </tr>
            </thead>
            <tbody>
              {ds.papers.map((pp) => (
                <tr key={pp.id}>
                  <td>
                    <Link to={`/dsssb/bank?paper=${pp.id}`}>{lang === "hi" ? pp.labelHi : pp.label}</Link>
                  </td>
                  <td>
                    {pp.postCode} · {pp.departmentShort}
                  </td>
                  <td>
                    {pp.date ? fmtDate(pp.date) : <span className="muted">{lang === "hi" ? "मुद्रित नहीं" : "not printed"}</span>}
                    <div className="xs muted">{pp.dateNote}</div>
                  </td>
                  <td>
                    {pp.shiftLabel} <span className={`chip ${pp.shiftStatus === "verified" ? "tone-good" : "tone-warning"}`}>{pp.shiftStatus}</span>
                  </td>
                  <td className="xs">{pp.answerKey.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{lang === "hi" ? "अपुष्ट / खुले प्रश्न" : "Not confirmed / open questions"}</h2>
        </div>
        <ul className="card small">
          {e.openQuestions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        {e.thirdParty.length > 0 && (
          <div className="card small">
            <strong>{lang === "hi" ? "तृतीय-पक्ष स्रोत (केवल तुलना हेतु)" : "Third-party sources (cross-check only)"}</strong>
            <ul>
              {e.thirdParty.map((x) => (
                <li key={x.source}>
                  <a href={x.source} target="_blank" rel="noreferrer">
                    {x.source.replace(/^https?:\/\//, "")}
                  </a>
                  : {x.note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
