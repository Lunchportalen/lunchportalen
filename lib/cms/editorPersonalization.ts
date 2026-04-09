/**
 * Lightweight editor “memory” (local only). Improves suggestions over time without server PII.
 * Opt-in by usage: only written when user applies an AI preset from the CMS assist UI.
 */

const STORAGE_KEY = "lp_cms_editor_ai_prefs_v1";

export type EditorAiPrefs = {
  /** Count of applied rewrites per preset id */
  presetCounts: Record<string, number>;
  updatedAt: string;
};

function safeParse(raw: string | null): EditorAiPrefs | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as EditorAiPrefs;
    if (!o || typeof o !== "object" || !o.presetCounts || typeof o.presetCounts !== "object") return null;
    return o;
  } catch {
    return null;
  }
}

export function readEditorAiPrefs(): EditorAiPrefs {
  if (typeof window === "undefined") {
    return { presetCounts: {}, updatedAt: new Date().toISOString() };
  }
  return safeParse(window.localStorage.getItem(STORAGE_KEY)) ?? { presetCounts: {}, updatedAt: new Date().toISOString() };
}

/** Call when user explicitly applies a rewrite suggestion. */
export function recordEditorRewritePreset(presetId: string): void {
  if (typeof window === "undefined") return;
  try {
    const cur = readEditorAiPrefs();
    const next: EditorAiPrefs = {
      presetCounts: { ...cur.presetCounts, [presetId]: (cur.presetCounts[presetId] ?? 0) + 1 },
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Optional nudge line for smart hints (Norwegian). */
export function personalizationHintLine(): string | null {
  if (typeof window === "undefined") return null;
  const { presetCounts } = readEditorAiPrefs();
  const entries = Object.entries(presetCounts).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  if (!top || top[1] < 2) return null;
  const [id, n] = top;
  if (id === "sales") {
    return `Du har ofte valgt salgsfokus (${n}×) — vi prioriterer tydelig nytte i forslag.`;
  }
  if (id === "shorten") {
    return `Du foretrekker korte tekster (${n}×) — korte forslag veies høyere.`;
  }
  if (id === "punch") {
    return `Du liker direkte tone (${n}×) — vi foreslår skarpere formuleringer.`;
  }
  return null;
}
