import "server-only";

import { editorTextSuggest, editorTextSuggestAsync, type EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import { opsLog } from "@/lib/ops/log";

/**
 * Conversion-focused copy improvement. Deterministic fallback via editorTextSuggest (no RNG).
 */
export async function improveContent(text: string, ctx: EditorTextRunContext): Promise<string> {
  const t = typeof text === "string" ? text.trim() : "";
  if (!t) return "";

  try {
    const out = await editorTextSuggestAsync({ text: t, action: "improve", locale: "nb" }, ctx);
    return out.suggestion.trim();
  } catch (e) {
    opsLog("improve_content_fallback", { message: e instanceof Error ? e.message : String(e) });
    return editorTextSuggest({ text: t, action: "improve", locale: "nb" }).suggestion.trim();
  }
}
