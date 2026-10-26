import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { compact } from "../lib/search";
import { LangCtx, type Lang } from "./i18n";
import { useUserState, type UserState } from "./state";
import type { DDataset, DQuestion, Note } from "./types";

const BASE = import.meta.env.BASE_URL;
export const asset = (path: string) => `${BASE}${path}`;

async function getJson<T>(name: string): Promise<T> {
  const r = await fetch(`${BASE}dsssb/data/${name}.json`);
  if (!r.ok) throw new Error(`${name}.json: HTTP ${r.status}. Run "npm run pipeline:dsssb" to build the DSSSB dataset.`);
  return r.json() as Promise<T>;
}

export function haystackOf(q: DQuestion, paperLabel: string): string {
  return compact(
    [q.text, q.textHi ?? "", q.passage ?? "", ...q.options.map((o) => `${o.text} ${o.textHi ?? ""}`), q.figureDescription ?? "", q.explanation?.text ?? "",
      q.classification.subject, q.classification.topic, q.classification.subtopic, q.concept ?? "", paperLabel, q.id].join(" "),
  );
}

export function indexDataset(raw: Omit<DDataset, "byId" | "paperById" | "groupById" | "haystack">): DDataset {
  const paperById = new Map(raw.papers.map((p) => [p.id, p]));
  const byId = new Map(raw.questions.map((q) => [q.id, q]));
  const groupById = new Map<string, DDataset["groups"]["repeat"][number]>();
  for (const k of ["exact", "repeat", "concept"] as const) for (const g of raw.groups[k]) groupById.set(g.id, g);
  const haystack = new Map(raw.questions.map((q) => [q.id, haystackOf(q, paperById.get(q.paperId)?.label ?? "")]));
  return { ...raw, byId, paperById, groupById, haystack };
}

export async function loadDataset(): Promise<DDataset> {
  const names = ["questions", "papers", "groups", "stats", "meta", "exam", "verification", "library"] as const;
  const [questions, papers, groups, stats, meta, exam, verification, library, notes] = await Promise.all([
    ...names.map((n) => getJson<unknown>(n)),
    getJson<unknown>("notes/index"),
  ]);
  return indexDataset({ questions, papers, groups, stats, meta, exam, verification, library, notes } as Omit<DDataset, "byId" | "paperById" | "groupById" | "haystack">);
}

interface Ctx {
  ds: DDataset;
  user: UserState;
  updateUser: (fn: (s: UserState) => UserState) => void;
  persistOk: boolean;
}

const DCtx = createContext<Ctx | null>(null);
const LANG_KEY = "dsssb-lang";

export function DsssbProvider({ children }: { children: ReactNode }) {
  const [ds, setDs] = useState<DDataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { state, update, persistOk } = useUserState();
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem(LANG_KEY) === "hi" ? "hi" : "en";
    } catch {
      return "en";
    }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* private mode */
    }
  };
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    loadDataset().then(setDs, (e: Error) => setErr(e.message));
  }, []);
  const langValue = useMemo(() => ({ lang, setLang }), [lang]);
  let body: ReactNode;
  if (err)
    body = (
      <div className="boot" role="alert">
        <div className="boot-logo">D</div>
        <h1>Could not load the DSSSB data</h1>
        <p>{err}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  else if (!ds)
    body = (
      <div className="boot" aria-busy="true">
        <div className="boot-logo" aria-hidden="true">
          D
        </div>
        <p>{lang === "hi" ? "लोड हो रहा है…" : "Loading questions…"}</p>
      </div>
    );
  else body = <DCtx.Provider value={{ ds, user: state, updateUser: update, persistOk }}>{children}</DCtx.Provider>;
  return <LangCtx.Provider value={langValue}>{body}</LangCtx.Provider>;
}

export function useD(): Ctx {
  const c = useContext(DCtx);
  if (!c) throw new Error("useD outside DsssbProvider");
  return c;
}

const noteCache = new Map<string, Promise<Note>>();

export function useNote(slug: string | undefined): { note: Note | null; error: string | null } {
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!slug) return;
    setNote(null);
    setError(null);
    if (!noteCache.has(slug)) noteCache.set(slug, getJson<Note>(`notes/${slug}`));
    noteCache.get(slug)!.then(setNote, (e: Error) => {
      noteCache.delete(slug);
      setError(e.message);
    });
  }, [slug]);
  return { note, error };
}

export function loadNote(slug: string): Promise<Note> {
  if (!noteCache.has(slug)) noteCache.set(slug, getJson<Note>(`notes/${slug}`));
  return noteCache.get(slug)!;
}
