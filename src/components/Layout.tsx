import { createContext, useContext, useEffect, useState, type ComponentType, type SVGProps } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useData } from "../data/store";
import { needsRevision } from "../lib/storage";
import { useTheme } from "../lib/theme";
import { IBookmark, IHome, IPlay, ISearch } from "./Icons";

type Tab = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; end?: boolean; dot?: number };

const ImmersiveCtx = createContext<(on: boolean) => void>(() => {});

/** Hide the tab bar while a test is running. */
export function useImmersive(on: boolean) {
  const set = useContext(ImmersiveCtx);
  useEffect(() => {
    set(on);
    return () => set(false);
  }, [on, set]);
}

export function Layout() {
  const { user } = useData();
  const loc = useLocation();
  const [immersive, setImmersive] = useState(false);
  useTheme(); // applies the saved theme on start-up
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  const toRevise = needsRevision(user).length;
  const tabs: Tab[] = [
    { to: "/", label: "Home", icon: IHome, end: true },
    { to: "/explore", label: "Questions", icon: ISearch },
    { to: "/practice", label: "Practice", icon: IPlay },
    { to: "/saved", label: "Saved", icon: IBookmark, dot: toRevise || undefined },
  ];

  return (
    <ImmersiveCtx.Provider value={setImmersive}>
      <div className={`app ${immersive ? "immersive" : ""}`}>
        <main id="main">
          <Outlet />
        </main>
      </div>
      {!immersive && (
        <nav className="tabbar" aria-label="Main">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
              <span className="pill">
                <t.icon />
              </span>
              {t.label}
              {t.dot ? <span className="tab-dot">{t.dot > 99 ? "99+" : t.dot}</span> : null}
            </NavLink>
          ))}
        </nav>
      )}
    </ImmersiveCtx.Provider>
  );
}
