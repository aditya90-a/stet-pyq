import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Md } from "../../components/ui";
import { PageHead, QRow, useNames } from "../components";
import { useLang, useT } from "../i18n";
import { loadNote, useD } from "../store";
import { BOX_DAYS, gradeCard, incorrectIds, isDue } from "../state";
import type { Note } from "../types";

function useAllNotes(enabled: boolean) {
  const { ds } = useD();
  const [notes, setNotes] = useState<Note[] | null>(null);
  useEffect(() => {
    if (!enabled || notes) return;
    Promise.all(ds.notes.filter((n) => n.available).map((n) => loadNote(n.slug).catch(() => null))).then((all) => setNotes(all.filter((x): x is Note => !!x)));
  }, [enabled, ds, notes]);
  return notes;
}

function Flashcards({ deck }: { deck: string }) {
  const { ds, user, updateUser } = useD();
  const { lang } = useLang();
  const t = useT();
  const notes = useAllNotes(true);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<"due" | "all">("due");
  const [sel, setSel] = useState(deck);
  const cards = useMemo(() => {
    if (!notes) return [];
    const out: { id: string; front: string; back: string; slug: string; topic: string }[] = [];
    for (const n of notes) {
      if (sel && n.slug !== sel) continue;
      (n.flashcards ?? []).forEach((c, i) => out.push({ id: `${n.slug}#${i}`, front: c.front, back: c.back, slug: n.slug, topic: n.topic }));
    }
    return out;
  }, [notes, sel]);
  const queue = mode === "due" ? cards.filter((c) => isDue(user.cards[c.id])) : cards;
  const [pos, setPos] = useState(0);
  useEffect(() => setPos(0), [sel, mode]);
  if (!notes) return <p className="muted">{t("loading")}</p>;
  const card = queue[Math.min(pos, queue.length - 1)];
  const grade = (knew: boolean) => {
    if (!card) return;
    updateUser((s) => gradeCard(s, card.id, knew));
    setFlipped(false);
    if (mode === "all") setPos((p) => (p + 1) % Math.max(1, queue.length));
  };
  const learned = cards.filter((c) => (user.cards[c.id]?.box ?? 0) >= 3).length;
  return (
    <div>
      <div className="filters">
        <select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Deck">
          <option value="">{lang === "hi" ? "सभी प्रकरण" : "All topics"}</option>
          {ds.notes
            .filter((n) => n.available && n.flashcards)
            .map((n) => (
              <option key={n.slug} value={n.slug}>
                {lang === "hi" ? n.titleHi ?? n.topicHi : n.topic} ({n.flashcards})
              </option>
            ))}
        </select>
        <div className="seg" role="group">
          <button aria-pressed={mode === "due"} onClick={() => setMode("due")}>
            {lang === "hi" ? "बाकी" : "Due"} ({cards.filter((c) => isDue(user.cards[c.id])).length})
          </button>
          <button aria-pressed={mode === "all"} onClick={() => setMode("all")}>
            {t("all")} ({cards.length})
          </button>
        </div>
      </div>
      <p className="xs muted">
        {lang === "hi" ? "लाइटनर पद्धति: याद हो तो अंतराल बढ़ता है" : "Leitner boxes: each correct recall pushes the card further out"} ({BOX_DAYS.join(", ")} {lang === "hi" ? "दिन" : "days"}). {learned}/{cards.length} {lang === "hi" ? "पक्के" : "learned"}.
      </p>
      {card ? (
        <div className={`flashcard ${flipped ? "flipped" : ""}`}>
          <button className="fc-face" onClick={() => setFlipped(!flipped)} aria-label={flipped ? "Show question" : "Show answer"}>
            <span className="xs muted">{card.topic}</span>
            <div className="fc-text">
              <Md text={flipped ? card.back : card.front} />
            </div>
            {!flipped && <span className="xs muted">{lang === "hi" ? "उत्तर देखने के लिए टैप करें" : "Tap to see the answer"}</span>}
          </button>
          {flipped && (
            <div className="fc-actions">
              <button className="btn btn-danger" onClick={() => grade(false)}>
                {lang === "hi" ? "याद नहीं" : "Didn't know"}
              </button>
              <button className="btn btn-primary" onClick={() => grade(true)}>
                {lang === "hi" ? "याद था" : "Knew it"}
              </button>
            </div>
          )}
          <p className="xs muted center">
            {Math.min(pos + 1, queue.length)} / {queue.length}
          </p>
        </div>
      ) : (
        <p className="empty">{lang === "hi" ? "अभी कोई कार्ड बाकी नहीं। बढ़िया!" : "No cards due right now. Well done!"}</p>
      )}
    </div>
  );
}

export function DRevise() {
  const { ds, user } = useD();
  const { lang } = useLang();
  const t = useT();
  const names = useNames();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") ?? "cards";
  const wrong = incorrectIds(user);
  const notes = useAllNotes(tab === "formulas" || tab === "quick");
  const tabs: [string, string][] = [
    ["cards", t("flashcards")],
    ["wrong", `${t("incorrect")} (${wrong.length})`],
    ["formulas", t("formulas")],
    ["quick", t("quickNotes")],
    ["saved", `${t("bookmarks")} (${user.bookmarks.length})`],
  ];
  return (
    <div className="dpage">
      <PageHead title={t("revise")} />
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tabchip ${tab === k ? "on" : ""}`} onClick={() => setSp({ tab: k }, { replace: true })}>
            {l}
          </button>
        ))}
      </div>
      {tab === "cards" && <Flashcards deck={sp.get("deck") ?? ""} />}
      {tab === "wrong" && (
        <>
          {wrong.length > 0 && (
            <Link className="btn btn-primary btn-block" to={`/dsssb/mock?preset=incorrect`}>
              {lang === "hi" ? "गलत प्रश्न दोबारा हल करें" : "Redo wrong answers"} ({wrong.length})
            </Link>
          )}
          <div className="list card">
            {wrong.map((id) => {
              const q = ds.byId.get(id);
              return q ? <QRow key={id} q={q} /> : null;
            })}
            {!wrong.length && <p className="muted small">{lang === "hi" ? "अभी कोई गलत उत्तर नहीं।" : "No wrong answers yet — practise to fill this list."}</p>}
          </div>
        </>
      )}
      {tab === "formulas" &&
        (notes ? (
          notes
            .filter((n) => n.formulas?.length)
            .map((n) => (
              <section key={n.slug} className="section">
                <div className="section-head">
                  <h2>
                    <Link to={`/dsssb/notes/${n.slug}`}>{lang === "hi" ? n.titleHi ?? n.topic : n.topic}</Link>
                  </h2>
                  <span className="xs muted">{names.subject(n.subject)}</span>
                </div>
                <div className="formulas card">
                  {n.formulas!.map((f, i) => (
                    <div key={i} className="formula">
                      <span className="formula-name">{f.name}</span>
                      <code>{f.formula}</code>
                      {f.note && <span className="xs muted">{f.note}</span>}
                    </div>
                  ))}
                </div>
              </section>
            ))
        ) : (
          <p className="muted">{t("loading")}</p>
        ))}
      {tab === "quick" &&
        (notes ? (
          notes.map((n) => (
            <details key={n.slug} className="card">
              <summary>
                <strong>{lang === "hi" ? n.titleHi ?? n.topic : n.topic}</strong> <span className="xs muted">{names.subject(n.subject)}</span>
              </summary>
              <ul>
                {(n.quickRevision ?? []).map((x, i) => (
                  <li key={i}>
                    <Md text={x} />
                  </li>
                ))}
              </ul>
            </details>
          ))
        ) : (
          <p className="muted">{t("loading")}</p>
        ))}
      {tab === "saved" && (
        <div className="list card">
          {user.bookmarks.map((id) => {
            const q = ds.byId.get(id);
            return q ? <QRow key={id} q={q} /> : null;
          })}
          {!user.bookmarks.length && <p className="muted small">{lang === "hi" ? "कोई बुकमार्क नहीं।" : "No bookmarks yet."}</p>}
        </div>
      )}
    </div>
  );
}
