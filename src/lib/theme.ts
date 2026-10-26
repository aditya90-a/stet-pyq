import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "stet-theme";

/** Explicit light/dark choice, or null to follow the system setting. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(() => {
    try {
      return (localStorage.getItem(KEY) as Theme | null) ?? null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try {
      if (theme) localStorage.setItem(KEY, theme);
      else localStorage.removeItem(KEY);
    } catch {
      /* private mode */
    }
    const dark = theme ? theme === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0a0f1e" : "#f3f6fd");
  }, [theme]);
  const effective: Theme = theme ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  return { theme, effective, setTheme, toggle: () => setTheme(effective === "dark" ? "light" : "dark") };
}
