import "server-only";

import { editorTextSuggest, editorTextSuggestAsync, type EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import { opsLog } from "@/lib/ops/log";

/**
 * Deterministic sequence summary → improved copy suggestion (no auto-send).
 * Input is serialized and clamped so the runner stays within policy limits.
 */
export async function improveSequence(sequence: unknown, ctx: EditorTextRunContext): Promise<string> {
  const raw = JSON.stringify(sequence ?? {});
  const text = raw.slice(0, 1800);
  const prompt = `Forbedre denne salgssekvensen (kun som forslag, B2B, kortere, tydelig CTA):\n\n${text}`;

  try {
    const out = await editorTextSuggestAsync({ text: prompt, action: "improve", locale: "nb" }, ctx);
    return out.suggestion.trim();
  } catch (e) {
    opsLog("improve_sequence_fallback", { message: e instanceof Error ? e.message : String(e) });
    return editorTextSuggest({ text: prompt, action: "improve", locale: "nb" }).suggestion.trim();
  }
}
