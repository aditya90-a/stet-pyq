import { useState } from "react";
import { Link } from "react-router-dom";
import { Kpi, PageHead, useNames } from "../components";
import { useLang, useT } from "../i18n";
import { useD } from "../store";
import type { VStatus } from "../types";

const ORDER: VStatus[] = ["verified", "corrected", "disputed", "unverified"];
const TONE: Record<VStatus, string> = { verified: "good", corrected: "accent", disputed: "critical", unverified: "warning" };

export function DVerification() {
  const { ds } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const v = ds.verification;
  const [tab, setTab] = useState<"open" | "corrections" | "dropped" | "metadata" | "files">("open");
  const [limit, setLimit] = useState(60);
  const total = ds.questions.length;
  return (
    <div className="dpage">
      <PageHead
        title={t("verification")}
        sub={
          lang === "hi"
            ? "हर निकाले गए प्रश्न की मूल प्रश्नपत्र से जाँच। कोई उत्तर चुपचाप नहीं बदला गया; हर संशोधन का साक्ष्य नीचे है।"
            : "Every extracted question checked against the original paper. No answer is ever changed silently; every correction is listed with its evidence."
        }
      />
      <div className="dkpis">
        {ORDER.map((s) => (
          <Link key={s} to={`/dsssb/bank?status=${s}`} className={`dkpi tone-${TONE[s]}`}>
            <strong>{v.totals[s] ?? 0}</strong>
            <span>
              {t(s)} · {pctLabel(v.totals[s] ?? 0, total)}
            </span>
          </Link>
        ))}
        <Kpi value={v.dropped.length} label={t("dropped")} />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>{lang === "hi" ? "स्थितियों का अर्थ" : "What the statuses mean"}</h2>
        </div>
        <dl className="card defs">
          {ORDER.map((s) => (
            <div key={s}>
              <dt>
                <span className={`chip tone-${TONE[s]}`}>{t(s)}</span>
              </dt>
              <dd className="small">{v.statusDefinitions[s]}</dd>
            </div>
          ))}
          <div>
            <dt>
              <span className="chip chip-warning">{t("dropped")}</span>
            </dt>
            <dd className="small">
              {lang === "hi"
                ? "DSSSB ने स्वयं प्रश्नपत्र में लिखा कि यह प्रश्न सभी उम्मीदवारों के लिए हटाया गया। ऐसे प्रश्न अंकन में नहीं गिने जाते।"
                : "DSSSB's own note printed in the paper says the question was ignored for all candidates. These are never scored in tests."}
            </dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{lang === "hi" ? "प्रश्नपत्र-वार" : "By paper"}</h2>
        </div>
        <div className="table-wrap card">
          <table className="dtable">
            <thead>
              <tr>
                <th>{t("paper")}</th>
                {ORDER.map((s) => (
                  <th key={s} className="num">
                    {t(s)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ds.papers.map((p) => (
                <tr key={p.id}>
                  <td>{names.paper(p.id)}</td>
                  {ORDER.map((s) => (
                    <td key={s} className="num">
                      {v.byPaper[p.id]?.[s] ?? 0}
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
          <h2>{t("checks")}</h2>
        </div>
        <div className="table-wrap card">
          <table className="dtable">
            <thead>
              <tr>
                <th>{lang === "hi" ? "जाँच" : "Check"}</th>
                <th className="num">pass</th>
                <th className="num">warn</th>
                <th className="num">fail</th>
                <th className="num">n/a</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(v.checks).map(([k, c]) => (
                <tr key={k}>
                  <td>{CHECK_LABEL[k] ?? k}</td>
                  <td className="num">{c.pass ?? 0}</td>
                  <td className="num">{c.warn ?? 0}</td>
                  <td className="num">{c.fail ?? 0}</td>
                  <td className="num">{c.na ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="tabs" role="tablist">
        {(
          [
            ["open", `${lang === "hi" ? "अनसुलझे" : "Unresolved"} (${v.open.length})`],
            ["corrections", `${t("corrections")} (${v.corrections.length})`],
            ["dropped", `${t("dropped")} (${v.dropped.length})`],
            ["metadata", lang === "hi" ? "मेटाडेटा" : "Metadata"],
            ["files", lang === "hi" ? "फ़ाइलें" : "Files"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tabchip ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === "open" && (
        <div className="list card">
          {v.open.map((o) => (
            <Link key={o.id} className="li vrow" to={`/dsssb/q/${o.id}`}>
              <div className="li-body">
                <span className="li-title clamp2">{o.text}</span>
                <span className="li-sub">
                  {names.paper(o.paperId)} · Q{o.qno} · {t("sourceKey")} {o.sourceKey ?? "–"} · AI {o.aiAnswer ?? "–"} ({o.aiConfidence ?? "–"})
                </span>
                <span className="xs">{o.failing.map((c) => `${CHECK_LABEL[c.id] ?? c.id}: ${c.detail}`).join(" · ")}</span>
              </div>
              <span className={`chip tone-${TONE[o.status]}`}>{t(o.status)}</span>
            </Link>
          ))}
          {!v.open.length && <p className="muted small">{lang === "hi" ? "कोई अनसुलझा प्रश्न नहीं।" : "Nothing unresolved."}</p>}
        </div>
      )}

      {tab === "corrections" && (
        <>
          <p className="xs muted">
            {lang === "hi"
              ? "केवल पाठ/विकल्प सुधार (OCR या निष्कर्षण त्रुटि) — मुद्रित पृष्ठ छवि से तुलना कर। उत्तर कुंजी कभी नहीं बदली गई।"
              : "Text/option fixes only (OCR or extraction errors), each made by comparing with the printed page image. Answer keys are never changed."}
          </p>
          <div className="list card">
            {v.corrections.slice(0, limit).map((c, i) => (
              <Link key={i} className="li" to={`/dsssb/q/${c.id}`}>
                <div className="li-body">
                  <span className="li-sub">
                    {names.paper(c.paperId)} · Q{c.qno} · {c.field}
                  </span>
                  <span className="small">
                    <del>{(c.from || "∅").slice(0, 140)}</del> → <ins>{c.to.slice(0, 140)}</ins>
                  </span>
                  <span className="xs muted">
                    {c.reason} · {c.evidence.pdf} p.{c.evidence.page}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {v.corrections.length > limit && (
            <button className="btn btn-soft btn-block" onClick={() => setLimit(limit + 100)}>
              {lang === "hi" ? "और दिखाएँ" : "Show more"}
            </button>
          )}
        </>
      )}

      {tab === "dropped" && (
        <div className="list card">
          {v.dropped.map((d) => (
            <Link key={d.id} className="li" to={`/dsssb/q/${d.id}`}>
              <div className="li-body">
                <span className="li-title">
                  {names.paper(d.paperId)} · Q{d.qno}
                </span>
                <span className="li-sub">{d.note}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {tab === "metadata" && (
        <>
          {v.metadata.map((m) => (
            <div key={m.paperId} className="card">
              <strong>{names.paper(m.paperId)}</strong>
              <div className="xs muted">
                {lang === "hi" ? "तिथि" : "date"}: {m.dateStatus} · {t("shift").toLowerCase()}: {m.shiftStatus} · {m.numbering.count} {t("questionsCount")}
                {m.numbering.gaps.length ? ` · gaps ${m.numbering.gaps.join(",")}` : ""}
                {m.numbering.duplicates.length ? ` · duplicate numbers ${m.numbering.duplicates.join(",")}` : ""}
              </div>
              <ul className="small">
                {m.checks.map((c) => (
                  <li key={c.field}>
                    <span className={`dot r-${c.result}`} /> {c.field}: {c.detail}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {v.syllabus.length > 0 && (
            <div className="card">
              <strong>{lang === "hi" ? "पाठ्यक्रम OCR सुधार" : "Syllabus OCR corrections"}</strong>
              <ul className="small">
                {v.syllabus.map((u) => (
                  <li key={`${u.part}${u.n}`}>
                    {u.part} {u.n}: OCR “{u.ocr}” → “{u.text}”
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {tab === "files" && (
        <div className="table-wrap card">
          <table className="dtable">
            <thead>
              <tr>
                <th>{lang === "hi" ? "फ़ाइल" : "File"}</th>
                <th>{t("status")}</th>
                <th>{lang === "hi" ? "प्रारूप" : "Format"}</th>
                <th className="num">{t("page")}</th>
                <th className="num">{t("questionsCount")}</th>
              </tr>
            </thead>
            <tbody>
              {v.files.map((f) => (
                <tr key={f.name}>
                  <td className="xs">{f.name}</td>
                  <td>{f.status}</td>
                  <td className="xs">{f.format}</td>
                  <td className="num">{f.pages}</td>
                  <td className="num">{f.questionsExtracted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {v.pipelineProblems.length > 0 && (
        <details className="card small">
          <summary>{lang === "hi" ? "पाइपलाइन टिप्पणियाँ" : "Pipeline notes"} ({v.pipelineProblems.length})</summary>
          <ul>
            {v.pipelineProblems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const CHECK_LABEL: Record<string, string> = {
  options: "Four options",
  key: "Key in source",
  "key-bilingual": "Same key EN/HI",
  "key-image": "Key on page image",
  "source-id": "Question ID",
  text: "Text source",
  hindi: "Hindi decoding",
  "bilingual-numbers": "Numbers EN/HI",
  metadata: "Paper metadata",
  "ai-answer": "Independent answer check",
  "cross-paper": "Cross-paper key",
  duplicate: "Within-paper duplicate",
};

function pctLabel(n: number, d: number) {
  const p = (100 * n) / d;
  return n > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}
