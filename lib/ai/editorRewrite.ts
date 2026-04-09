/**
 * CMS editor: AI text assist contract (client + shared).
 * - Suggestions only; caller applies text — never auto-mutate without explicit user action.
 * - Uses POST /api/ai/rewrite (deterministic rewrite + safe length limits).
 */

export type EditorRewritePresetId = "sales" | "shorten" | "punch";

export type EditorRewritePreset = {
  id: EditorRewritePresetId;
  /** UI label (Norwegian) */
  label: string;
  /** Shown after suggestion — why the model did what it did */
  explain: string;
  /** Sent to /api/ai/rewrite as `intent` (matched by lib/ai/rewrite.normalizeIntent) */
  apiIntent: string;
};

/** Curated intents: map to deterministic rewrite modes (no arbitrary prompts). */
export const EDITOR_REWRITE_PRESETS: readonly EditorRewritePreset[] = [
  {
    id: "sales",
    label: "Mer salgsfokusert",
    explain: "Forslaget tydeliggjør nytte og trygghet — du velger selv om du vil bruke det.",
    apiIntent: "Gjør teksten mer salgsfokusert og konkret for B2B-målgruppe",
  },
  {
    id: "shorten",
    label: "Forkort",
    explain: "Forslaget strammer inn ordlyden uten å endre meningen.",
    apiIntent: "Forkort teksten",
  },
  {
    id: "punch",
    label: "Mer punch",
    explain: "Forslaget skjerper tonen og gjør budskapet mer direkte.",
    apiIntent: "Lag mer punch og slagkraft i teksten",
  },
] as const;

export type EditorRewriteResult = {
  ok: true;
  text: string;
  preset: EditorRewritePreset;
};

export type EditorRewriteError = {
  ok: false;
  message: string;
};

/**
 * Calls public rewrite endpoint; returns improved text for user to accept.
 */
export async function fetchEditorRewrite(
  text: string,
  preset: EditorRewritePreset,
  init?: RequestInit,
): Promise<EditorRewriteResult | EditorRewriteError> {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: "Ingen tekst å forbedre." };
  }
  try {
    const res = await fetch("/api/ai/rewrite", {
      method: "POST",
      headers: { "content-type": "application/json", ...(init?.headers as Record<string, string>) },
      ...init,
      body: JSON.stringify({ text: trimmed, intent: preset.apiIntent }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      data?: { rewritten?: string };
      message?: string;
    };
    if (!res.ok || json.ok === false) {
      return { ok: false, message: json.message ?? "Kunne ikke hente forslag." };
    }
    const rewritten = String(json.data?.rewritten ?? "").trim();
    if (!rewritten) {
      return { ok: false, message: "Tomt forslag — prøv igjen." };
    }
    return { ok: true, text: rewritten, preset };
  } catch {
    return { ok: false, message: "Nettverksfeil — prøv igjen." };
  }
}
