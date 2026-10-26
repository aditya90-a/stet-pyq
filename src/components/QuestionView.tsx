import { useState } from "react";
import { Link } from "react-router-dom";
import { assetUrl, useData } from "../data/store";
import type { Question } from "../data/types";
import { ANSWER_STATUS } from "../lib/format";
import { recordAnswer } from "../lib/storage";
import { ICheckCircle, IFlame, IXCircle } from "./Icons";
import { Md, RepeatBadge, Seg } from "./ui";

export function hasHindi(q: Question) {
  return !!q.textHi || q.options.some((o) => o.textHi && o.textHi !== o.text);
}

interface OptionsProps {
  q: Question;
  lang: "en" | "hi";
  /** display order: order[displayIndex] = original option index */
  order?: number[];
  chosen: number | null;
  reveal: boolean;
  onPick?: (orig: number) => void;
}

/** Option buttons. Before `reveal` they act as a radio group; afterwards they show the key and the user's pick. */
export function Options({ q, lang, order, chosen, reveal, onPick }: OptionsProps) {
  const key = q.answer.index;
  const idx = order ?? q.options.map((_, i) => i);
  return (
    <div className="opts" role={reveal ? "list" : "radiogroup"} aria-label="Options">
      {idx.map((orig, di) => {
        const o = q.options[orig];
        const isKey = reveal && orig === key;
        const isWrong = reveal && chosen === orig && orig !== key;
        const cls = ["opt", isKey ? "correct" : isWrong ? "wrong" : !reveal && chosen === orig ? "selected" : reveal && chosen !== null ? "dim" : ""].join(" ");
        const hi = lang === "hi" && o.textHi && o.textHi !== o.text;
        const body = (
          <>
            <span className="opt-label">{"ABCD"[di] ?? o.label}</span>
            <span className="opt-body">
              {hi ? <span lang="hi">{o.textHi}</span> : <span>{o.text || <em className="muted">[blank in source]</em>}</span>}
              {isKey && <span className="opt-note" style={{ color: "var(--good-ink)" }}>Correct answer{chosen === orig ? " · your pick" : ""}</span>}
              {isWrong && <span className="opt-note" style={{ color: "var(--critical-ink)" }}>Your pick</span>}
            </span>
            {isKey && <ICheckCircle className="opt-mark" />}
            {isWrong && <IXCircle className="opt-mark" />}
          </>
        );
        return reveal || !onPick ? (
          <div key={orig} className={cls} role="listitem">
            {body}
          </div>
        ) : (
          <button key={orig} type="button" className={cls} role="radio" aria-checked={chosen === orig} onClick={() => onPick(orig)}>
            {body}
          </button>
        );
      })}
    </div>
  );
}

/** Key status, source notes and the AI explanation, shown once an answer is revealed. */
export function AnswerPanel({ q, chosen, order }: { q: Question; chosen: number | null; order?: number[] }) {
  const key = q.answer.index;
  const keyLetter = key === null ? "n/a" : "ABCD"[order ? order.indexOf(key) : key];
  const tone = chosen === null ? "" : chosen === key ? "good" : "bad";
  return (
    <div className={`answer-box ${tone}`}>
      {chosen !== null && (
        <div className="answer-head" style={{ color: chosen === key ? "var(--good-ink)" : "var(--critical-ink)" }}>
          {chosen === key ? <ICheckCircle /> : <IXCircle />}
          {chosen === key ? "Correct!" : `Not quite — answer is ${keyLetter}`}
        </div>
      )}
      {(q.answer.status === "disputed" || q.answer.status === "ambiguous") && (
        <div className="notice notice-warning">
          <div>
            <strong>{ANSWER_STATUS[q.answer.status].label}.</strong> {q.aiCheck?.note || q.answer.notes.join(". ")}
          </div>
        </div>
      )}
      {q.explanation?.text && <Md text={q.explanation.text} />}
      <p className="xs muted">Key from the source paper{q.explanation ? " · explanation written by AI" : ""}</p>
    </div>
  );
}

/** Full question for study: tap an option to check yourself, or reveal the answer. */
export function QuestionView({ q }: { q: Question }) {
  const { ds, updateUser } = useData();
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [chosen, setChosen] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const paper = ds.paperById.get(q.paperId)!;
  const family = q.repeat.repeatGroup ? ds.groupById.get(q.repeat.repeatGroup) : undefined;
  const others = family ? family.members.filter((m) => m !== q.id) : [];
  const showHi = lang === "hi" && q.textHi;

  const pick = (orig: number) => {
    setChosen(orig);
    setReveal(true);
    if (q.answer.index !== null) updateUser((s) => recordAnswer(s, q.id, orig === q.answer.index));
  };

  return (
    <article className="qv" aria-labelledby={`qt-${q.id}`}>
      <div className="qv-meta">
        <Link className="chip chip-accent" to={`/papers/${paper.id}`}>
          {paper.shortLabel} · Q{q.qno}
        </Link>
        <RepeatBadge papers={q.repeat.distinctPapers} />
        {q.textOrigin !== "pdf-text-layer" && (
          <span className="chip chip-warning" title="The question is an image in the source PDF and was transcribed by hand">
            Transcribed
          </span>
        )}
      </div>
      {hasHindi(q) && (
        <Seg
          label="Language"
          value={lang}
          onChange={setLang}
          options={[
            ["en", "English"],
            ["hi", "हिन्दी"],
          ]}
        />
      )}
      <div id={`qt-${q.id}`} className={showHi ? "qv-text hi" : "qv-text"} lang={showHi ? "hi" : "en"}>
        {showHi ? q.textHi : q.text || <em className="muted">Question text not available in source.</em>}
      </div>
      {q.figures.map((f) => (
        <img key={f.file} className="figure" src={assetUrl(f.file)} alt={`Figure for question ${q.qno}`} loading="lazy" />
      ))}
      <Options q={q} lang={lang} chosen={chosen} reveal={reveal} onPick={q.answer.index !== null ? pick : undefined} />
      {reveal ? (
        <AnswerPanel q={q} chosen={chosen} />
      ) : (
        <button className="btn btn-soft btn-block" onClick={() => setReveal(true)}>
          Show answer
        </button>
      )}

      {others.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>
              <IFlame width={18} height={18} style={{ color: "var(--flame)", verticalAlign: -3, marginRight: 6 }} />
              Also asked in
            </h2>
          </div>
          <div className="fam-papers">
            {[q.id, ...others].map((m) => {
              const mq = ds.byId.get(m)!;
              const mp = ds.paperById.get(mq.paperId)!;
              return m === q.id ? (
                <span key={m} className="fam-paper" style={{ outline: "1.5px solid var(--accent)" }}>
                  {mp.shortLabel} · Q{mq.qno}
                </span>
              ) : (
                <Link key={m} className="fam-paper" to={`/q/${m}`} replace>
                  {mp.shortLabel} · Q{mq.qno}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
