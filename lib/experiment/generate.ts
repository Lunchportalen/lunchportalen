import "server-only";

import type { EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import { editorTextSuggestAsync } from "@/lib/ai/editorTextSuggest";
import { opsLog } from "@/lib/ops/log";

/**
 * AI generation only — no routing/selection decisions here.
 */
export async function generateVariant(postText: string, ctx: EditorTextRunContext): Promise<string> {
  const t = typeof postText === "string" ? postText.trim() : "";
  if (!t) return "";

  const framed = [
    "Forbedre for B2B-konvertering: sterkere åpning, tydelig verdi, kort CTA.",
    "",
    t.slice(0, 3800),
  ].join("\n");

  try {
    const out = await editorTextSuggestAsync({ text: framed, action: "improve", locale: "nb" }, ctx);
    return out.suggestion.trim();
  } catch (e) {
    opsLog("revenue_generate_variant_failed", { message: e instanceof Error ? e.message : String(e) });
    return "";
  }
}
