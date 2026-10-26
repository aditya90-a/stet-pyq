import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IFile } from "../../components/Icons";
import { PageHead } from "../components";
import { useLang, useT } from "../i18n";
import { asset, useD } from "../store";

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

export function DLibrary() {
  const { ds } = useD();
  const { lang } = useLang();
  const t = useT();
  const [local, setLocal] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // the PDFs are copied for local use only (git-ignored), so check which ones this server has
    for (const f of ds.library.filter((x) => x.type === "pdf"))
      fetch(asset(f.url), { method: "HEAD" })
        .then((r) => setLocal((m) => ({ ...m, [f.name]: r.ok && (r.headers.get("content-type") ?? "").includes("pdf") })))
        .catch(() => setLocal((m) => ({ ...m, [f.name]: false })));
  }, [ds]);
  return (
    <div className="dpage">
      <PageHead
        title={t("library")}
        sub={
          lang === "hi"
            ? "स्रोत फ़ाइलें, संसाधन स्थिति, पृष्ठ संदर्भ और सत्यापन। मूल PDF कभी बदले नहीं जाते।"
            : "Source files, processing status, page references and verification. The original PDFs are never modified."
        }
      />
      <div className="list">
        {ds.library.map((f) => {
          const p = f.paperId ? ds.paperById.get(f.paperId) : undefined;
          return (
            <div key={f.name} className="card libfile">
              <div className="libfile-head">
                <span className="li-icon tint-accent">
                  <IFile />
                </span>
                <div>
                  <strong>{p ? (lang === "hi" ? p.labelHi : p.label) : f.label}</strong>
                  <div className="xs muted">{f.name}</div>
                </div>
                <span className={`chip ${f.status === "ok" || f.status === "ocr" ? "tone-good" : "tone-warning"}`}>{f.status}</span>
              </div>
              <div className="kv small">
                <div>
                  <span>{lang === "hi" ? "प्रकार" : "Kind"}</span>
                  <span>
                    {f.kind} · {f.format ?? "—"}
                  </span>
                </div>
                <div>
                  <span>{t("page")}</span>
                  <span>
                    {f.pages} · {fmtSize(f.sizeBytes)} · md5 {f.md5?.slice(0, 8)}
                  </span>
                </div>
                {f.kind === "question-paper" && (
                  <>
                    <div>
                      <span>{t("questionsCount")}</span>
                      <span>
                        <Link to={`/dsssb/bank?paper=${f.paperId}`}>{f.questions}</Link> ·{" "}
                        {Object.entries(f.verification)
                          .map(([k, n]) => `${n} ${k}`)
                          .join(", ")}
                      </span>
                    </div>
                    <div>
                      <span>{lang === "hi" ? "बिना प्रश्न वाले पृष्ठ" : "Pages without questions"}</span>
                      <span className="xs">{f.pagesWithoutQuestions.join(", ") || "—"}</span>
                    </div>
                    {p && (
                      <div>
                        <span>{lang === "hi" ? "पोस्ट कोड" : "Post code"}</span>
                        <span>
                          {p.postCode} · {p.department} · {p.answerKey.label}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {f.kind === "syllabus" && (
                  <div>
                    <span>OCR</span>
                    <span>
                      {ds.exam.syllabus.ocrEngine} · <Link to="/dsssb/syllabus">{t("syllabus")}</Link>
                    </span>
                  </div>
                )}
                {[...f.errors, ...f.warnings].length > 0 && (
                  <div>
                    <span>{lang === "hi" ? "चेतावनी" : "Warnings"}</span>
                    <span className="xs">{[...f.errors, ...f.warnings].join("; ")}</span>
                  </div>
                )}
              </div>
              {local[f.name] ? (
                <a className="btn btn-soft btn-sm" href={asset(f.url)} target="_blank" rel="noreferrer">
                  {lang === "hi" ? "PDF खोलें" : "Open PDF"}
                </a>
              ) : (
                <p className="xs muted">
                  {lang === "hi"
                    ? "PDF इस सर्वर पर प्रकाशित नहीं है (केवल स्थानीय प्रति)। प्रश्न पृष्ठ संख्या से जुड़े हैं।"
                    : "The PDF is not published on this server (local copy only). Questions still cite their page numbers."}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <section className="section">
        <div className="section-head">
          <h2>{lang === "hi" ? "रिपोर्ट" : "Reports"}</h2>
        </div>
        <div className="card small">
          <p>
            {lang === "hi" ? "पूरी रिपोर्टें रिपॉज़िटरी में हैं:" : "Full reports are generated in the repository:"} <code>reports/dsssb/</code> — verification_report.md, verification_open.csv, corrections.csv,
            analysis_report.md, repeat_report.md, topic_stats.csv, questions.csv, notes_coverage.md.
          </p>
          <Link to="/dsssb/verification">{t("verification")} →</Link>
        </div>
      </section>
    </div>
  );
}
