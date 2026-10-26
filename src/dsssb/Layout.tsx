import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { IBook, IBookmark, ICalendar, ICheckCircle, IFile, IFlame, IGrid, IHome, IInfo, ILang, ILayers, IMoon, IPlay, IRotate, ISearch, ISun, ITarget, ITrophy, IX } from "../components/Icons";
import { useTheme } from "../lib/theme";
import { useLang, useT, type Key } from "./i18n";
import { useD } from "./store";
import { incorrectIds } from "./state";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
interface NavItem {
  to: string;
  key: Key;
  icon: Icon;
  end?: boolean;
}

const NAV: { group: string; groupHi: string; items: NavItem[] }[] = [
  { group: "Prepare", groupHi: "तैयारी", items: [
    { to: "/dsssb", key: "home", icon: IHome, end: true },
    { to: "/dsssb/exam", key: "exam", icon: IInfo },
    { to: "/dsssb/syllabus", key: "syllabus", icon: ILayers },
    { to: "/dsssb/notes", key: "notes", icon: IBook },
  ] },
  { group: "Practise", groupHi: "अभ्यास", items: [
    { to: "/dsssb/bank", key: "bank", icon: ISearch },
    { to: "/dsssb/mock", key: "mock", icon: IPlay },
    { to: "/dsssb/revise", key: "revise", icon: IRotate },
    { to: "/dsssb/planner", key: "planner", icon: ICalendar },
  ] },
  { group: "Analyse", groupHi: "विश्लेषण", items: [
    { to: "/dsssb/analysis", key: "analysis", icon: IGrid },
    { to: "/dsssb/repeats", key: "repeats", icon: IFlame },
    { to: "/dsssb/analytics", key: "analytics", icon: ITarget },
    { to: "/dsssb/verification", key: "verification", icon: ICheckCircle },
    { to: "/dsssb/library", key: "library", icon: IFile },
  ] },
];

const TABS: NavItem[] = [
  { to: "/dsssb", key: "home", icon: IHome, end: true },
  { to: "/dsssb/bank", key: "questions", icon: ISearch },
  { to: "/dsssb/mock", key: "mock", icon: IPlay },
  { to: "/dsssb/revise", key: "revise", icon: IRotate },
];

export function DLayout() {
  const t = useT();
  const { lang, setLang } = useLang();
  const { effective, toggle } = useTheme();
  const { user } = useD();
  const loc = useLocation();
  const [more, setMore] = useState(false);
  const immersive = /\/dsssb\/mock\/run/.test(loc.pathname);
  useEffect(() => {
    window.scrollTo(0, 0);
    setMore(false);
  }, [loc.pathname]);
  // ?lang=hi or ?lang=en in a shared link selects the interface language
  useEffect(() => {
    const l = new URLSearchParams(loc.search).get("lang");
    if (l === "hi" || l === "en") setLang(l);
  }, [loc.search]); // eslint-disable-line react-hooks/exhaustive-deps
  const wrongCount = incorrectIds(user).length;
  useEffect(() => {
    const prev = document.title;
    document.title = "DSSSB TGT Computer Science · PYQ";
    return () => {
      document.title = prev;
    };
  }, []);

  const navList = (
    <nav aria-label="DSSSB sections">
      {NAV.map((g) => (
        <div key={g.group} className="dnav-group">
          <div className="dnav-head">{lang === "hi" ? g.groupHi : g.group}</div>
          {g.items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `dnav-item ${isActive ? "active" : ""}`}>
              <i.icon />
              <span>{t(i.key)}</span>
              {i.key === "revise" && wrongCount > 0 && <span className="tab-dot inline">{wrongCount > 99 ? "99+" : wrongCount}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className={`dsssb ${immersive ? "immersive" : ""}`}>
      {!immersive && (
        <header className="dtop">
          <Link to="/dsssb" className="dbrand">
            <span className="logo" aria-hidden="true">D</span>
            <span>
              <strong>{t("appShort")}</strong>
              <small>{lang === "hi" ? "PYQ · नोट्स · मॉक" : "PYQs · Notes · Mocks"}</small>
            </span>
          </Link>
          <div className="dtop-actions">
            <button className="lang-btn" onClick={() => setLang(lang === "hi" ? "en" : "hi")} aria-label="Switch language / भाषा बदलें">
              <ILang /> {lang === "hi" ? "English" : "हिन्दी"}
            </button>
            <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${effective === "dark" ? "light" : "dark"} theme`}>
              {effective === "dark" ? <ISun /> : <IMoon />}
            </button>
            <Link className="icon-btn" to="/" aria-label="Bihar STET section" title={t("switchExam")}>
              <ITrophy />
            </Link>
          </div>
        </header>
      )}
      <div className="dshell">
        {!immersive && <aside className="dside">{navList}</aside>}
        <main id="main" className="dmain">
          <Outlet />
        </main>
      </div>
      {!immersive && (
        <nav className="tabbar dtabbar" aria-label="Main">
          {TABS.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
              <span className="pill">
                <i.icon />
              </span>
              {t(i.key)}
              {i.key === "revise" && wrongCount > 0 && <span className="tab-dot">{wrongCount > 99 ? "99+" : wrongCount}</span>}
            </NavLink>
          ))}
          <button className={`tab ${more ? "active" : ""}`} onClick={() => setMore(true)}>
            <span className="pill">
              <IBookmark />
            </span>
            {t("more")}
          </button>
        </nav>
      )}
      {more && (
        <>
          <div className="sheet-scrim" onClick={() => setMore(false)} aria-hidden="true" />
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t("more")}>
            <div className="sheet-grip" aria-hidden="true" />
            <div className="sheet-head">
              <h2>{t("appTitle")}</h2>
              <button className="icon-btn" aria-label="Close" onClick={() => setMore(false)}>
                <IX />
              </button>
            </div>
            <div className="sheet-body dmore">{navList}</div>
          </div>
        </>
      )}
    </div>
  );
}
