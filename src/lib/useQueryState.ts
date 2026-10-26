import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/** Filters live in the URL so every filtered view can be bookmarked or shared. */
export function useQueryState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => {
    const o = {} as Partial<Record<K, string>>;
    for (const k of keys) {
      const v = params.get(k);
      if (v) o[k] = v;
    }
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const set = useCallback(
    (k: K, v: string) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (v) n.set(k, v);
          else n.delete(k);
          // narrowing the hierarchy resets children
          if (k === "subject") {
            n.delete("topic");
            n.delete("subtopic");
          }
          if (k === "topic") n.delete("subtopic");
          if (k !== "page") n.delete("page");
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );
  const setMany = useCallback(
    (vals: Partial<Record<K, string>>) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          n.delete("page");
          for (const [k, v] of Object.entries(vals) as [string, string | undefined][]) {
            if (v) n.set(k, v);
            else n.delete(k);
          }
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );
  const clear = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);
  return { state, set, setMany, clear, params };
}
