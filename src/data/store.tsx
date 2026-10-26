import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { buildHaystack } from "../lib/search";
import { useUserState, type UserState } from "../lib/storage";
import type { Dataset, Group, Groups, Meta, Paper, Question, Stats } from "./types";

const BASE = import.meta.env.BASE_URL;

async function getJson<T>(name: string): Promise<T> {
  const r = await fetch(`${BASE}data/${name}.json`);
  if (!r.ok) throw new Error(`${name}.json: HTTP ${r.status}. Run "npm run pipeline" to generate the dataset.`);
  return r.json() as Promise<T>;
}

export function indexDataset(raw: Omit<Dataset, "byId" | "paperById" | "groupById" | "haystack">): Dataset {
  const paperById = new Map(raw.papers.map((p) => [p.id, p]));
  const byId = new Map(raw.questions.map((q) => [q.id, q]));
  const groupById = new Map<string, Group>();
  for (const k of ["exact", "repeat", "concept"] as const) for (const g of raw.groups[k]) groupById.set(g.id, g);
  const haystack = new Map(raw.questions.map((q) => [q.id, buildHaystack(q, paperById.get(q.paperId)?.label ?? "")]));
  return { ...raw, byId, paperById, groupById, haystack };
}

export async function loadDataset(): Promise<Dataset> {
  const [questions, papers, groups, stats, meta] = await Promise.all([
    getJson<Question[]>("questions"),
    getJson<Paper[]>("papers"),
    getJson<Groups>("groups"),
    getJson<Stats>("stats"),
    getJson<Meta>("meta"),
  ]);
  return indexDataset({ questions, papers, groups, stats, meta });
}

interface Ctx {
  ds: Dataset;
  user: UserState;
  updateUser: (fn: (s: UserState) => UserState) => void;
  persistOk: boolean;
}

const DataCtx = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { state, update, persistOk } = useUserState();
  useEffect(() => {
    loadDataset().then(setDs, (e: Error) => setErr(e.message));
  }, []);
  if (err)
    return (
      <div className="boot" role="alert">
        <div className="boot-logo">Q</div>
        <h1>Could not load the questions</h1>
        <p>{err}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  if (!ds)
    return (
      <div className="boot" aria-busy="true">
        <div className="boot-logo" aria-hidden="true">
          Q
        </div>
        <p>Loading questions…</p>
      </div>
    );
  return <DataCtx.Provider value={{ ds, user: state, updateUser: update, persistOk }}>{children}</DataCtx.Provider>;
}

export function useData(): Ctx {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData outside DataProvider");
  return c;
}

export const assetUrl = (path: string) => `${BASE}${path}`;
