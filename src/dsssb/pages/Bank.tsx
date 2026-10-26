import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { IChevronL, IChevronR, ISearch } from "../../components/Icons";
import { matchesQuery, queryTerms } from "../../lib/search";
import { LETTERS, PageHead, QRow, StatusBadge, StudyQuestion, useNames } from "../components";
import { useLang, useT } from "../i18n";
import { asset, useD } from "../store";
import type { DDataset, DQuestion } from "../types";

const LIST_KEY = "dsssb-last-list";

function rememberList(ids: string[]) {
  try {
    sessionStorage.setItem(LIST_KEY, JSON.stringify(ids.slice(0, 2000)));
  } catch {
    /* ignore */
  }
}

function lastList(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(LIST_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export interface BankFilters {
  q: string;
  subject: string;
  topic: string;
  paper: string;
  status: string;
  difficulty: string;
  repeated: boolean;
  saved: boolean;
}

export function filterBank(ds: DDataset, f: BankFilters, bookmarks: string[]): DQuestion[] {
  const terms = queryTerms(f.q);
  return ds.questions.filter((q) => {
    if (f.subject && q.classification.subject !== f.subject) return false;
    if (f.topic && `${q.classification.subject}|${q.classification.topic}` !== f.topic) return false;
    if (f.paper && q.paperId !== f.paper) return false;
    if (f.status) {
      if (f.status === "dropped" ? q.answer.status !== "dropped" : q.verification.status !== f.status) return false;
    }
    if (f.difficulty && q.difficulty !== f.difficulty) return false;
    if (f.repeated && q.repeat.distinctPapers < 2 && q.repeat.conceptPapers < 2) return false;
    if (f.saved && !bookmarks.includes(q.id)) return false;
    if (terms.length && !matchesQuery(ds.haystack.get(q.id) ?? "", terms)) return false;
    return true;
  });
}

export function DBank() {
  const { ds, user } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const [sp, setSp] = useSearchParams();
  const f: BankFilters = {
    q: sp.get("q") ?? "",
    subject: sp.get("subject") ?? "",
    topic: sp.get("topic") ?? "",
    paper: sp.get("paper") ?? "",
    status: sp.get("status") ?? "",
    difficulty: sp.get("difficulty") ?? "",
    repeated: sp.get("repeated") === "1",
    saved: sp.get("saved") === "1",
  };
  const [text, setText] = useState(f.q);
  useEffect(() => setText(f.q), [f.q]);
  const set = (k: keyof BankFilters, v: string | boolean) => {
    const n = new URLSearchParams(sp);
    if (v === "" || v === false) n.delete(k);
    else n.set(k, v === true ? "1" : String(v));
    if (k === "subject") n.delete("topic");
    setSp(n, { replace: true });
  };
  const results = useMemo(() => filterBank(ds, f, user.bookmarks), [ds, sp, user.bookmarks]); // eslint-disable-line react-hooks/exhaustive-deps
  const [limit, setLimit] = useState(40);
  useEffect(() => {
    setLimit(40);
    rememberList(results.map((q) => q.id));
  }, [results]);
  const subjects = Object.keys(ds.meta.taxonomy);
  const topics = f.subject ? Object.keys(ds.meta.taxonomy[f.subject]?.topics ?? {}) : [];
  const active = [f.subject, f.topic, f.paper, f.status, f.difficulty, f.repeated, f.saved].filter(Boolean).length;
  return (
    <div className="dpage">
      <PageHead title={t("bank")} sub={`${results.length} / ${ds.questions.length} ${t("questionsCount")}`} />
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          set("q", text.trim());
        }}
      >
        <ISearch />
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("search")} />
        <button className="btn btn-primary btn-sm" type="submit">
          {t("search")}
        </button>
      </form>
      <div className="filters">
        <select value={f.subject} onChange={(e) => set("subject", e.target.value)} aria-label={t("subject")}>
          <option value="">{t("subject")}: {t("all")}</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {names.subject(s)}
            </option>
          ))}
        </select>
        <select value={f.topic} onChange={(e) => set("topic", e.target.value)} aria-label={t("topic")} disabled={!f.subject && !f.topic}>
          <option value="">{t("topic")}: {t("all")}</option>
          {f.topic && !f.subject && <option value={f.topic}>{f.topic.split("|")[1]}</option>}
          {topics.map((tp) => (
            <option key={tp} value={`${f.subject}|${tp}`}>
              {names.topic(f.subject, tp)}
            </option>
          ))}
        </select>
        <select value={f.paper} onChange={(e) => set("paper", e.target.value)} aria-label={t("paper")}>
          <option value="">{t("paper")}: {t("all")}</option>
          {ds.papers.map((p) => (
            <option key={p.id} value={p.id}>
              {lang === "hi" ? p.labelHi : p.label}
            </option>
          ))}
        </select>
        <select value={f.status} onChange={(e) => set("status", e.target.value)} aria-label={t("status")}>
          <option value="">{t("status")}: {t("all")}</option>
          {(["verified", "corrected", "disputed", "unverified"] as const).map((s) => (
            <option key={s} value={s}>
              {t(s)} ({ds.stats.byStatus[s] ?? 0})
            </option>
          ))}
          <option value="dropped">{t("dropped")}</option>
        </select>
        <select value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)} aria-label={t("difficulty")}>
          <option value="">{t("difficulty")}: {t("all")}</option>
          {(["easy", "medium", "hard"] as const).map((d) => (
            <option key={d} value={d}>
              {t(d)}
            </option>
          ))}
        </select>
        <label className="fcheck">
          <input type="checkbox" checked={f.repeated} onChange={(e) => set("repeated", e.target.checked)} /> {t("repeats")}
        </label>
        <label className="fcheck">
          <input type="checkbox" checked={f.saved} onChange={(e) => set("saved", e.target.checked)} /> {t("bookmarks")} ({user.bookmarks.length})
        </label>
        {(active > 0 || f.q) && (
          <button className="btn btn-soft btn-sm" onClick={() => setSp(new URLSearchParams(), { replace: true })}>
            {t("clear")}
          </button>
        )}
      </div>
      {results.length > 0 && (
        <div className="row-actions">
          <Link className="btn btn-soft btn-sm" to={`/dsssb/mock?ids=${encodeURIComponent(results.slice(0, 200).map((q) => q.id).join(","))}`}>
            {lang === "hi" ? "इन प्रश्नों से टेस्ट" : "Practise these"} ({Math.min(200, results.length)})
          </Link>
        </div>
      )}
      <div className="list card">
        {results.slice(0, limit).map((q) => (
          <QRow key={q.id} q={q} />
        ))}
        {!results.length && <p className="muted small">{t("noResults")}</p>}
      </div>
      {results.length > limit && (
        <button className="btn btn-soft btn-block" onClick={() => setLimit(limit + 60)}>
          {lang === "hi" ? "और दिखाएँ" : "Show more"} ({results.length - limit})
        </button>
      )}
    </div>
  );
}

export function DQuestionPage() {
  const { id } = useParams();
  const { ds } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const nav = useNavigate();
  const q = id ? ds.byId.get(id) : undefined;
  const list = useMemo(() => lastList(), []);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!q || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const i = list.indexOf(q.id);
      if (e.key === "ArrowRight" && i >= 0 && i < list.length - 1) nav(`/dsssb/q/${list[i + 1]}`, { replace: true });
      if (e.key === "ArrowLeft" && i > 0) nav(`/dsssb/q/${list[i - 1]}`, { replace: true });
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [q, list, nav]);
  if (!q) return <div className="dpage">{lang === "hi" ? "प्रश्न नहीं मिला" : "Question not found"}</div>;
  const p = ds.paperById.get(q.paperId)!;
  const i = list.indexOf(q.id);
  const v = q.verification;
  const pdfHref = (page: number) => `${asset(p.pdf.url)}#page=${page}`;
  return (
    <div className="dpage">
      <div className="qnav">
        <button className="icon-btn" disabled={i <= 0} onClick={() => nav(`/dsssb/q/${list[i - 1]}`, { replace: true })} aria-label={t("prev")}>
          <IChevronL />
        </button>
        <span className="xs muted">{i >= 0 ? `${i + 1} / ${list.length}` : ""}</span>
        <button className="icon-btn" disabled={i < 0 || i >= list.length - 1} onClick={() => nav(`/dsssb/q/${list[i + 1]}`, { replace: true })} aria-label={t("next")}>
          <IChevronR />
        </button>
      </div>
      <StudyQuestion key={q.id} q={q} />

      <section className="section">
        <div className="section-head">
          <h2>
            {t("verification")}: <StatusBadge q={q} />
          </h2>
        </div>
        <div className="card">
          <p className="small">{ds.verification.statusDefinitions[v.status]}</p>
          <table className="dtable checks">
            <tbody>
              {v.checks.map((c) => (
                <tr key={c.id} className={`r-${c.result}`}>
                  <td>
                    <span className={`dot r-${c.result}`} aria-label={c.result} />
                  </td>
                  <td>{c.label}</td>
                  <td className="xs">{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {v.notes.map((n) => (
            <p key={n} className="xs notice notice-warning">
              {n}
            </p>
          ))}
          {v.corrections.length > 0 && (
            <>
              <h3 className="h3">{t("corrections")}</h3>
              <ul className="corrections">
                {v.corrections.map((c, k) => (
                  <li key={k}>
                    <strong>{c.field}</strong>: <del>{c.from || "∅"}</del> → <ins>{c.to}</ins>
                    <div className="xs muted">
                      {c.reason} · {c.evidence.pdf} p.{c.evidence.page}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("evidence")}</h2>
        </div>
        <div className="card kv">
          <div>
            <span>{t("paper")}</span>
            <span>
              {names.paper(p.id)} · {p.postCode} ({p.departmentShort})
            </span>
          </div>
          <div>
            <span>{lang === "hi" ? "स्रोत" : "Source"}</span>
            <span>
              {p.pdf.name} · {t("page")} {q.source.page}
              {q.source.pageEnd !== q.source.page ? `–${q.source.pageEnd}` : ""}{" "}
              <a href={pdfHref(q.source.pageEn ?? q.source.page)} target="_blank" rel="noreferrer">
                {t("openPdf")}
              </a>
            </span>
          </div>
          <div>
            <span>{lang === "hi" ? "मूल क्रमांक" : "Printed numbering"}</span>
            <span>
              Q{q.sectionQno ?? q.qno} · {q.sectionRaw} {q.sourceQid ? `· Question ID ${q.sourceQid}` : ""}
            </span>
          </div>
          <div>
            <span>{t("answer")}</span>
            <span>
              {q.answer.label ? `${q.answer.label} — ${q.answer.source}` : q.answer.officialNote ?? t("noKey")}
            </span>
          </div>
          {q.aiCheck && (
            <div>
              <span>{lang === "hi" ? "स्वतंत्र जाँच" : "Independent check"}</span>
              <span>
                AI: {q.aiCheck.derivedLabel ?? "—"} ({q.aiCheck.confidence ?? "—"}, {q.aiCheck.assessment}) {q.aiCheck.note && `— ${q.aiCheck.note}`}
              </span>
            </div>
          )}
          <div>
            <span>{lang === "hi" ? "पाठ का स्रोत" : "Text source"}</span>
            <span>
              {q.textOrigin}
              {q.ocr ? ` · OCR ${q.ocr.engine}, mean confidence ${q.ocr.meanConf}` : ""}
            </span>
          </div>
          <div>
            <span>{t("topic")}</span>
            <span>
              {names.subject(q.classification.subject)} › {names.topic(q.classification.subject, q.classification.topic)} › {q.classification.subtopic}
              {q.concept ? ` · ${q.concept}` : ""} · {t(q.difficulty === "not rated" ? "difficulty" : q.difficulty)}
            </span>
          </div>
          {q.hindiFixes.length > 0 && (
            <div>
              <span>{lang === "hi" ? "हिन्दी मरम्मत" : "Hindi repair"}</span>
              <span className="xs">{q.hindiFixes.join(", ")}</span>
            </div>
          )}
          {p.evidence.length > 0 && (
            <div>
              <span>{lang === "hi" ? "DSSSB सूचनाएँ" : "DSSSB notices"}</span>
              <span>
                {p.evidence.map((u, k) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="xs">
                    [{k + 1}]{" "}
                  </a>
                ))}
              </span>
            </div>
          )}
        </div>
      </section>

      {q.repeat.matches.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{t("repeats")}</h2>
          </div>
          <div className="list card">
            {q.repeat.matches.map((m) => {
              const mq = ds.byId.get(m.id);
              return mq ? (
                <QRow
                  key={m.id}
                  q={mq}
                  right={<span className={`chip ${m.type === "concept" ? "chip-accent" : "chip-flame"}`}>{m.type === "concept" ? t("sameConcept") : m.type === "exact" ? t("exact") : t("paraphrase")}</span>}
                />
              ) : null;
            })}
          </div>
        </section>
      )}
      <p className="xs muted">
        {lang === "hi" ? "सही विकल्प अक्षर" : "Option letters"} {LETTERS} {lang === "hi" ? "मूल 1–4 के क्रम में हैं।" : "follow the printed order 1–4."}
      </p>
    </div>
  );
}
