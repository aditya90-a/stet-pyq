import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IAlert, IBookmark, ICheckCircle, IChevronR, IInfo, IXCircle } from "../components/Icons";
import { Md } from "../components/ui";
import { tr, useLang, useT, type Lang } from "./i18n";
import { asset, useD } from "./store";
import { recordAnswer, toggleBookmark } from "./state";
import type { DQuestion, VStatus } from "./types";

export const LETTERS = "ABCD";

// The pipeline writes superscripts as "^x" (10^-12, x^2) and subscripts as "_x" (log_2 n, (1071)_10).
// Subscripts in these papers are numeric bases and indices, so only digits are taken ("log_2x" → log₂x).
const SCRIPT = /\^([−–+-]?[0-9A-Za-z.]+)|(?<=[0-9A-Za-z)\]])_([0-9]{1,3})(?![0-9_])/g;

/** Plain text with ^/_ script markers rendered as <sup>/<sub>. */
export function Rich({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(SCRIPT)) {
    out.push(text.slice(last, m.index));
    out.push(m[1] !== undefined ? <sup key={m.index}>{m[1]}</sup> : <sub key={m.index}>{m[2]}</sub>);
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

export const STATUS_TONE: Record<VStatus, string> = { verified: "good", corrected: "accent", disputed: "critical", unverified: "warning" };

export function StatusBadge({ q }: { q: DQuestion }) {
  const t = useT();
  if (q.answer.status === "dropped")
    return (
      <span className="chip chip-warning" title={q.answer.officialNote ?? ""}>
        {t("dropped")}
      </span>
    );
  const s = q.verification.status;
  return <span className={`chip tone-${STATUS_TONE[s]}`}>{t(s)}</span>;
}

/** Subject / topic names in the chosen language (taxonomy carries the Hindi names). */
export function useNames() {
  const { ds } = useD();
  const { lang } = useLang();
  return {
    subject: (s: string) => (lang === "hi" ? ds.meta.taxonomy[s]?.hi ?? s : s),
    topic: (s: string, t: string) => (lang === "hi" ? ds.meta.taxonomy[s]?.topics[t]?.hi ?? t : t),
    paper: (id: string) => {
      const p = ds.paperById.get(id);
      return p ? (lang === "hi" ? p.labelHi : p.label) : id;
    },
  };
}

export function showHindi(q: DQuestion, lang: Lang) {
  return lang === "hi" && !!q.textHi;
}

function Images({ files, alt }: { files: string[]; alt: string }) {
  return (
    <>
      {files.map((f) => (
        <img key={f} className="figure" src={asset(f)} alt={alt} loading="lazy" />
      ))}
    </>
  );
}

/** Question stem: passage, text in the chosen language, figures and a toggle for the original images. */
export function QStem({ q, lang }: { q: DQuestion; lang: Lang }) {
  const t = useT();
  const [orig, setOrig] = useState(false);
  const hi = showHindi(q, lang);
  const passage = hi && q.passageHi ? q.passageHi : q.passage;
  // image-only sources (2023): the transcription is shown, the printed image is one tap away
  const imageSource = q.textOrigin.startsWith("ocr") || q.textOrigin === "transcribed" || q.textOrigin === "mixed-ocr";
  const figures = imageSource ? [] : hi && q.imagesHi.length ? q.imagesHi : q.images;
  const originals = hi && q.imagesHi.length ? q.imagesHi : q.images;
  return (
    <div className="dq-stem">
      {passage && (
        <details className="dq-passage" open>
          <summary>{t("passage")}</summary>
          <div className={hi ? "hi" : undefined} lang={hi ? "hi" : "en"}>
            {passage}
          </div>
          <Images files={q.passageImages} alt="Passage figure" />
        </details>
      )}
      <div className={`qv-text ${hi || q.lang === "hi" ? "hi" : ""}`} lang={hi || q.lang === "hi" ? "hi" : "en"}>
        {hi ? <Rich text={q.textHi ?? ""} /> : q.text ? <Rich text={q.text} /> : <em className="muted">[question printed as an image]</em>}
      </div>
      <Images files={figures} alt={`Figure for question ${q.qno}`} />
      {q.figureDescription && <p className="xs muted">Figure: {q.figureDescription}</p>}
      {imageSource && originals.length > 0 && (
        <button type="button" className="linklike xs" onClick={() => setOrig(!orig)} aria-expanded={orig}>
          {orig ? "▾" : "▸"} {t("originalImage")}
        </button>
      )}
      {orig && (
        <div className="originals">
          <Images files={originals} alt={`Original question ${q.qno} as printed`} />
          {q.options.map((o, i) =>
            (hi && o.imagesHi.length ? o.imagesHi : o.images).map((f) => (
              <div key={f} className="orig-opt">
                <span className="opt-label">{LETTERS[i]}</span>
                <img className="opt-img" src={asset(f)} alt={`Option ${LETTERS[i]} as printed`} loading="lazy" />
              </div>
            )),
          )}
        </div>
      )}
    </div>
  );
}

interface OptsProps {
  q: DQuestion;
  lang: Lang;
  chosen: number | null;
  reveal: boolean;
  onPick?: (i: number) => void;
}

export function Opts({ q, lang, chosen, reveal, onPick }: OptsProps) {
  const t = useT();
  const keys = q.answer.indices;
  return (
    <div className="opts" role={reveal || !onPick ? "list" : "radiogroup"} aria-label="Options">
      {q.options.map((o, i) => {
        const isKey = reveal && keys.includes(i);
        const isWrong = reveal && chosen === i && !keys.includes(i);
        const cls = ["opt", isKey ? "correct" : isWrong ? "wrong" : !reveal && chosen === i ? "selected" : reveal && chosen !== null ? "dim" : ""].join(" ");
        const hi = lang === "hi" && o.textHi && o.textHi !== o.text;
        const imgs = hi && o.imagesHi.length ? o.imagesHi : o.images;
        // a picture option (figure, tree, symbol) is shown as the picture; transcribed text options as text
        const imageOnly = !o.text.trim() || /^\[(Figure|Tree|Symbol|Diagram)/i.test(o.text);
        const body = (
          <>
            <span className="opt-label">{LETTERS[i]}</span>
            <span className="opt-body">
              {hi ? <span lang="hi"><Rich text={o.textHi ?? ""} /></span> : o.text && !imageOnly ? <span><Rich text={o.text} /></span> : null}
              {imageOnly && imgs.map((f) => <img key={f} className="opt-img" src={asset(f)} alt={`Option ${LETTERS[i]}`} loading="lazy" />)}
              {isKey && <span className="opt-note" style={{ color: "var(--good-ink)" }}>{t("sourceKey")}{chosen === i ? " ✓" : ""}</span>}
              {isWrong && <span className="opt-note" style={{ color: "var(--critical-ink)" }}>{lang === "hi" ? "आपका उत्तर" : "Your pick"}</span>}
            </span>
            {isKey && <ICheckCircle className="opt-mark" />}
            {isWrong && <IXCircle className="opt-mark" />}
          </>
        );
        return reveal || !onPick ? (
          <div key={i} className={cls} role="listitem">
            {body}
          </div>
        ) : (
          <button key={i} type="button" className={cls} role="radio" aria-checked={chosen === i} onClick={() => onPick(i)}>
            {body}
          </button>
        );
      })}
    </div>
  );
}

/** Answer, verification status and explanation; never presents a disputed key as settled. */
export function AnswerPanel({ q, chosen }: { q: DQuestion; chosen: number | null }) {
  const t = useT();
  const { lang } = useLang();
  const keys = q.answer.indices;
  const right = chosen !== null && keys.includes(chosen);
  const v = q.verification;
  return (
    <div className={`answer-box ${chosen === null ? "" : right ? "good" : "bad"}`}>
      {chosen !== null && keys.length > 0 && (
        <div className="answer-head" style={{ color: right ? "var(--good-ink)" : "var(--critical-ink)" }}>
          {right ? <ICheckCircle /> : <IXCircle />}
          {right ? t("correct") : `${t("sourceKey")}: ${keys.map((k) => LETTERS[k]).join(", ")}`}
        </div>
      )}
      {q.answer.status === "dropped" && (
        <div className="notice notice-warning">
          <IAlert />
          <div>
            <strong>{t("dropped")}.</strong> {q.answer.officialNote}
            {q.aiCheck?.derivedLabel && (
              <>
                {" "}
                {lang === "hi" ? "AI समीक्षा का उत्तर" : "AI review's answer"}: <strong>{q.aiCheck.derivedLabel}</strong> ({q.aiCheck.confidence}) — {lang === "hi" ? "आधिकारिक नहीं" : "not official"}.
              </>
            )}
          </div>
        </div>
      )}
      {v.status === "disputed" && (
        <div className="notice notice-critical">
          <IAlert />
          <div>
            <strong>{lang === "hi" ? "कुंजी विवादित" : "Key disputed"}.</strong>{" "}
            {lang === "hi" ? "स्रोत में चिह्नित उत्तर" : "The answer marked in the source is"} <strong>{q.answer.label}</strong>
            {q.aiCheck?.derivedLabel && q.aiCheck.derivedLabel !== q.answer.label && (
              <>
                {"; "}
                {lang === "hi" ? "स्वतंत्र AI जाँच" : "independent AI check"}: <strong>{q.aiCheck.derivedLabel}</strong>
              </>
            )}
            . {q.aiCheck?.note}
          </div>
        </div>
      )}
      {v.status === "unverified" && (
        <div className="notice notice-warning">
          <IInfo />
          <div>{lang === "hi" ? "यह प्रश्न पूरी तरह सत्यापित नहीं है:" : "Not fully verified:"} {v.checks.filter((c) => c.result === "warn" || c.result === "fail").map((c) => c.detail).join("; ")}</div>
        </div>
      )}
      {q.explanation?.text && <Md text={q.explanation.text} />}
      <p className="xs muted">
        {q.answer.source}
        {q.answer.official ? "" : lang === "hi" ? " (आधिकारिक प्रति नहीं)" : " (not the official copy)"}. {q.explanation ? t("aiWritten") : ""}{" "}
        <Link to={`/dsssb/q/${q.id}`}>{t("evidence")} →</Link>
      </p>
    </div>
  );
}

/** Interactive study view of one question (tap an option to check yourself). */
export function StudyQuestion({ q, compactMeta }: { q: DQuestion; compactMeta?: boolean }) {
  const { user, updateUser } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const [chosen, setChosen] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const canScore = q.answer.indices.length > 0;
  const pick = (i: number) => {
    setChosen(i);
    setReveal(true);
    if (canScore) updateUser((s) => recordAnswer(s, q.id, q.answer.indices.includes(i)));
  };
  const saved = user.bookmarks.includes(q.id);
  return (
    <article className="qv">
      {!compactMeta && (
        <div className="qv-meta">
          <span className="chip chip-accent">
            {names.paper(q.paperId)} · Q{q.qno}
          </span>
          <StatusBadge q={q} />
          {q.repeat.distinctPapers > 1 && <span className="chip chip-flame">{t("repeatedIn")} {q.repeat.distinctPapers}×</span>}
          <button className={`chip chip-btn ${saved ? "on" : ""}`} onClick={() => updateUser((s) => toggleBookmark(s, q.id))} aria-pressed={saved}>
            <IBookmark /> {saved ? t("bookmarked") : t("bookmark")}
          </button>
        </div>
      )}
      <QStem q={q} lang={lang} />
      <Opts q={q} lang={lang} chosen={chosen} reveal={reveal} onPick={canScore ? pick : undefined} />
      {reveal || !canScore ? (
        <AnswerPanel q={q} chosen={chosen} />
      ) : (
        <button className="btn btn-soft btn-block" onClick={() => setReveal(true)}>
          {t("showAnswer")}
        </button>
      )}
    </article>
  );
}

export function QRow({ q, to, right }: { q: DQuestion; to?: string; right?: ReactNode }) {
  const { lang } = useLang();
  const names = useNames();
  const hi = showHindi(q, lang);
  return (
    <Link className="li dq-row" to={to ?? `/dsssb/q/${q.id}`}>
      <div className="li-body">
        <span className={`li-title clamp2 ${hi || q.lang === "hi" ? "hi" : ""}`}>{(hi ? q.textHi : q.text) || "[image question]"}</span>
        <span className="li-sub">
          {names.paper(q.paperId)} · Q{q.qno} · {names.topic(q.classification.subject, q.classification.topic)}
        </span>
      </div>
      <span className="li-end">
        {right}
        <StatusBadge q={q} />
        <IChevronR className="chev" />
      </span>
    </Link>
  );
}

export function HBar({ label, value, max, sub, tone, to }: { label: ReactNode; value: number; max: number; sub?: ReactNode; tone?: string; to?: string }) {
  const inner = (
    <>
      <div className="hbar-top">
        <span className="hbar-label">{label}</span>
        <span className="hbar-val">{sub ?? value}</span>
      </div>
      <div className={`hbar-track ${tone ?? ""}`} aria-hidden="true">
        <span style={{ width: `${max ? Math.max(value ? 2 : 0, (100 * value) / max) : 0}%` }} />
      </div>
    </>
  );
  return to ? (
    <Link className="hbar" to={to}>
      {inner}
    </Link>
  ) : (
    <div className="hbar">{inner}</div>
  );
}

export function SourceLink({ url, official, title }: { url: string; official?: boolean; title?: string }) {
  const { lang } = useLang();
  return (
    <a className="src-link" href={url} target="_blank" rel="noreferrer">
      <span className={`chip ${official ? "tone-good" : "tone-warning"}`}>{official ? tr(lang, "officialSource") : tr(lang, "notOfficial")}</span>
      <span className="src-title">{title ?? url.replace(/^https?:\/\//, "")}</span>
    </a>
  );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="dpage-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="dpage-actions">{actions}</div>}
    </div>
  );
}

export function Kpi({ value, label, tone }: { value: ReactNode; label: ReactNode; tone?: string }) {
  return (
    <div className={`dkpi ${tone ? `tone-${tone}` : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
