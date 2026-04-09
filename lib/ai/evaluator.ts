import "server-only";

import { runAIAnalysis } from "@/lib/ai/engine";
import type { AiGeneratedBlock, CMSContentInput } from "@/lib/ai/types";

export type VariantEvaluation = {
  score: number;
  delta: number;
  reasoning: string;
};

/**
 * Compare variant blocks to baseline using the same SEO+CRO blend as the main AI engine.
 * Read-only — does not mutate CMS.
 */
export async function evaluateVariant(
  original: CMSContentInput,
  variant: { blocks: AiGeneratedBlock[] },
): Promise<VariantEvaluation> {
  const baseline = (await runAIAnalysis(original)).score;
  const merged: CMSContentInput = { ...original, blocks: variant.blocks };
  const next = (await runAIAnalysis(merged)).score;
  const delta = next - baseline;

  let reasoning: string;
  if (delta > 3) {
    reasoning = `Variant øker samlet SEO/CRO-score med +${delta} poeng vs. utgangspunkt (simulert, ingen trafikkdata).`;
  } else if (delta < -3) {
    reasoning = `Variant ligger ${Math.abs(delta)} poeng under baseline — vurder å beholde original eller justere struktur/CTA.`;
  } else {
    reasoning = `Lav effekt (${delta >= 0 ? "+" : ""}${delta} poeng): marginal endring i heuristisk score; kombiner med manuell QA.`;
  }

  return { score: next, delta, reasoning };
}
