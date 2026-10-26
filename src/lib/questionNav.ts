// Remembers the list a question was opened from, so the question screen can offer Prev / Next.
const KEY = "stet-pyq-list";

export interface QuestionList {
  ids: string[];
  label: string;
}

export function rememberList(ids: string[], label: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ids, label }));
  } catch {
    /* storage blocked: Prev/Next falls back to paper order */
  }
}

function recall(): QuestionList | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QuestionList) : null;
  } catch {
    return null;
  }
}

/** Neighbours of `id` in the remembered list, or in `fallback` (paper order) when it is not part of it. */
export function neighbours(id: string, fallback: QuestionList): { prev: string | null; next: string | null; pos: number; total: number; label: string } {
  const remembered = recall();
  const list = remembered && remembered.ids.includes(id) ? remembered : fallback;
  const i = list.ids.indexOf(id);
  return { prev: i > 0 ? list.ids[i - 1] : null, next: i >= 0 && i < list.ids.length - 1 ? list.ids[i + 1] : null, pos: i + 1, total: list.ids.length, label: list.label };
}
