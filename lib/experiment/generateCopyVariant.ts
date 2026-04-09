import "server-only";

import type { EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import { improveContent } from "@/lib/ai/improveContent";
import type { HypothesisResult } from "@/lib/experiment/hypothesis";
import { opsLog } from "@/lib/ops/log";

/**
 * Genererer B-variant av tekst via eksisterende AI-kanal (server-only).
 * Beslutninger (hypotese → type) er allerede deterministiske; LLM brukes kun til generering.
 */
export async function generateCopyVariant(
  text: string,
  hypothesis: HypothesisResult,
  ctx: EditorTextRunContext
): Promise<string> {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return "";

  const augmented = [
    `[Hypotese — ${hypothesis.type}]`,
    hypothesis.hypothesis,
    "",
    "Regler for forbedring:",
    "- sterkere hook (første 2 linjer)",
    "- konkret verdi (ikke generisk)",
    "- én tydelig CTA",
    "- maks 5 linjer i hovedtekst",
    "",
    "Original:",
    raw,
  ].join("\n");

  opsLog("generate_copy_variant_start", { hypothesisType: hypothesis.type });
  const out = await improveContent(augmented, ctx);
  return out.trim() || raw;
}
