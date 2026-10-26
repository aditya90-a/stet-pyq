import { useMemo } from "react";
import { Link } from "react-router-dom";
import { IBook, ICalendar, ICheckCircle, IChevronR, IFlame, IGrid, IPlay, IRotate, ITarget } from "../../components/Icons";
import { fmtNum } from "../../lib/format";
import { HBar, Kpi, useNames } from "../components";
import { useLang, useT } from "../i18n";
import { useD } from "../store";
import { incorrectIds, isDue, reviewDue, today } from "../state";

export const EXAM_START = "2026-11-27";

export function daysUntil(iso: string) {
  const d = new Date(iso + "T09:00:00").getTime() - Date.now();
  return Math.max(0, Math.ceil(d / 86400000));
}

export function DHome() {
  const { ds, user } = useD();
  const t = useT();
  const { lang } = useLang();
  const names = useNames();
  const tot = ds.stats.totals;
  const v = ds.stats.byStatus;
  const done = user.planner.log[today()] ?? 0;
  const goal = user.planner.dailyGoal;
  const examFact = ds.exam.current.find((f) => f.key === "exam_dates_41_26");
  const dueCards = useMemo(() => Object.values(user.cards).filter((c) => isDue(c)).length, [user.cards]);
  const totalCards = ds.notes.reduce((a, n) => a + (n.flashcards ?? 0), 0);
  const dueTopics = Object.values(user.topicReviews).filter((r) => reviewDue(r)).length;
  const wrong = incorrectIds(user).length;
  const csTopics = ds.stats.topics.filter((r) => r.subject === "Computer Science" && r.topic !== "Unclassified").slice(0, 8);
  const maxCs = Math.max(...csTopics.map((r) => r.perDoePaper ?? r.perPaper));
  const verifiedPct = Math.round((100 * ((v.verified ?? 0) + (v.corrected ?? 0))) / tot.questions);

  const modes = [
    { to: "/dsssb/mock?preset=full", icon: IPlay, tone: "rose", title: t("fullMock"), sub: lang === "hi" ? "200 प्रश्न · 120 मिनट · −0.25" : "200 Q · 120 min · −0.25" },
    { to: "/dsssb/notes", icon: IBook, tone: "green", title: t("studyNotes"), sub: `${ds.notes.filter((n) => n.available).length} ${lang === "hi" ? "प्रकरण" : "topics"}` },
    { to: "/dsssb/analysis", icon: IGrid, tone: "violet", title: t("analysis"), sub: `${tot.papers} ${lang === "hi" ? "प्रश्नपत्र" : "papers"}` },
    { to: "/dsssb/revise", icon: IRotate, tone: "gold", title: t("revise"), sub: Object.keys(user.cards).length ? `${dueCards} ${lang === "hi" ? "कार्ड बाकी" : "cards due"}` : `${totalCards} ${t("flashcards").toLowerCase()}` },
  ];

  return (
    <div className="dpage">
      <section className="hero dhero">
        <div className="hero-copy">
          <span className="hero-kicker">{lang === "hi" ? "पोस्ट कोड 41/26 · शिक्षा निदेशालय" : "Post code 41/26 · Directorate of Education"}</span>
          <h1 className="hero-title">{t("appTitle")}</h1>
          <p>
            {lang === "hi"
              ? `${fmtNum(tot.questions)} वास्तविक प्रश्न, ${tot.papers} प्रश्नपत्रों (2021–2024) से — हर प्रश्न स्रोत PDF के पृष्ठ से जुड़ा और सत्यापित।`
              : `${fmtNum(tot.questions)} real questions from ${tot.papers} papers (2021–2024), each linked to its source PDF page and checked.`}
          </p>
        </div>
        <div className="countdown" title={examFact?.value}>
          <strong>{daysUntil(EXAM_START)}</strong>
          <span>{t("daysLeft")}</span>
          <small>{lang === "hi" ? "पहली पाली 27 नवम्बर 2026" : "First shift 27 Nov 2026"}</small>
        </div>
      </section>

      <div className="dkpis">
        <Kpi value={fmtNum(tot.questions)} label={lang === "hi" ? "PYQ" : "PYQs"} />
        <Kpi value={`${verifiedPct}%`} label={lang === "hi" ? "सत्यापित/संशोधित" : "verified or corrected"} tone="good" />
        <Kpi value={v.disputed ?? 0} label={t("disputed")} tone="critical" />
        <Kpi value={tot.dropped} label={lang === "hi" ? "DSSSB द्वारा हटाए" : "dropped by DSSSB"} />
      </div>

      <section className="card dtoday">
        <div className="section-head">
          <h2>{t("today")}</h2>
          <Link to="/dsssb/planner" className="xs">
            {t("planner")} →
          </Link>
        </div>
        <HBar label={t("dailyGoal")} value={Math.min(done, goal)} max={goal} sub={`${done}/${goal}`} tone="good" />
        <div className="today-grid">
          <Link to="/dsssb/revise?tab=cards" className="today-item">
            <IRotate /> <strong>{Object.keys(user.cards).length ? dueCards : totalCards}</strong> {Object.keys(user.cards).length ? (lang === "hi" ? "फ़्लैशकार्ड बाकी" : "flashcards due") : lang === "hi" ? "फ़्लैशकार्ड उपलब्ध" : "flashcards to start"}
          </Link>
          <Link to="/dsssb/revise?tab=wrong" className="today-item">
            <ITarget /> <strong>{wrong}</strong> {lang === "hi" ? "गलत प्रश्न दोहराएँ" : "wrong answers to redo"}
          </Link>
          <Link to="/dsssb/planner" className="today-item">
            <ICalendar /> <strong>{dueTopics}</strong> {lang === "hi" ? "प्रकरण पुनरावृत्ति बाकी" : "topic revisions due"}
          </Link>
        </div>
      </section>

      <div className="modes">
        {modes.map((m) => (
          <Link key={m.to} to={m.to} className={`mode mode-${m.tone}`}>
            <span className="mode-icon">
              <m.icon />
            </span>
            <span className="mode-title">{m.title}</span>
            <span className="mode-sub">{m.sub}</span>
          </Link>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <h2>{lang === "hi" ? "सबसे अधिक पूछे जाने वाले CS प्रकरण" : "Most-asked Computer Science topics"}</h2>
          <Link to="/dsssb/analysis" className="xs">
            {t("analysis")} →
          </Link>
        </div>
        <p className="xs muted">{lang === "hi" ? "DoE प्रश्नपत्रों (2021, 2023) में औसत प्रश्न प्रति प्रश्नपत्र" : "Average questions per DoE paper (2021 sets and 2023)"}</p>
        <div className="card">
          {csTopics.map((r) => (
            <HBar key={r.topic} label={names.topic(r.subject, r.topic)} value={r.perDoePaper ?? r.perPaper} max={maxCs} sub={(r.perDoePaper ?? r.perPaper).toFixed(1)} to={`/dsssb/bank?topic=${encodeURIComponent(`${r.subject}|${r.topic}`)}`} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{lang === "hi" ? "यहाँ के आँकड़ों के बारे में" : "About this data"}</h2>
        </div>
        <div className="list card">
          <Link className="li" to="/dsssb/verification">
            <span className="li-icon tint-good">
              <ICheckCircle />
            </span>
            <div className="li-body">
              <span className="li-title">{t("verification")}</span>
              <span className="li-sub">
                {lang === "hi"
                  ? "हर प्रश्न की जाँच: स्रोत पृष्ठ, उत्तर कुंजी, OCR, स्वतंत्र हल। सभी विवाद और संशोधन साक्ष्य सहित।"
                  : "Every question checked: source page, key, OCR, independent solve. All disputes and corrections with evidence."}
              </span>
            </div>
            <IChevronR className="chev" />
          </Link>
          <Link className="li" to="/dsssb/exam">
            <span className="li-icon tint-accent">
              <IFlame />
            </span>
            <div className="li-body">
              <span className="li-title">{t("exam")}</span>
              <span className="li-sub">
                {lang === "hi"
                  ? "आधिकारिक DSSSB स्रोतों से: विज्ञापन 03/2026, पात्रता, पैटर्न, अंकन, पुराने पोस्ट कोड।"
                  : "From official DSSSB sources: Advt 03/2026, eligibility, pattern, marking, past post codes."}
              </span>
            </div>
            <IChevronR className="chev" />
          </Link>
        </div>
        <p className="xs muted">
          {lang === "hi"
            ? "07 फ़रवरी 2024 का प्रश्नपत्र NDMC (पोस्ट कोड 70/23) का है, जिसका पाठ्यक्रम DoE 41/26 से अलग है।"
            : "The 07 Feb 2024 paper is for NDMC (post code 70/23), whose syllabus differs from DoE 41/26; analytics label it separately."}
        </p>
      </section>
    </div>
  );
}
