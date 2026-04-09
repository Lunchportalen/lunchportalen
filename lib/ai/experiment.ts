import "server-only";

import { evaluateVariant } from "@/lib/ai/evaluator";
import type { CMSContentInput } from "@/lib/ai/types";
import { generateVariants, type AiVariantRunContext, type ProposedVariant } from "@/lib/ai/variantGenerator";

export type ExperimentVariantEntry = ProposedVariant & {
  evaluation: {
    score: number;
    delta: number;
    reasoning: string;
  };
};

export type ExperimentRecord = {
  id: string;
  contentId: string;
  status: "draft" | "running" | "completed";
  variants: ExperimentVariantEntry[];
  winner?: {
    variantId: string;
    score: number;
    reason: string;
  };
  /** True: scores from heuristics/LLM only — no live traffic split. */
  simulated: true;
  createdAt: string;
};

/**
 * Build an experiment record with simulated evaluation only (no A/B traffic, no CMS writes).
 */
export async function finalizeExperiment(
  contentId: string,
  baseContent: CMSContentInput,
  proposed: ProposedVariant[],
): Promise<ExperimentRecord> {
  const evaluated: ExperimentVariantEntry[] = await Promise.all(
    proposed.map(async (p) => ({
      ...p,
      evaluation: await evaluateVariant(baseContent, { blocks: p.blocks }),
    })),
  );

  const sorted = [...evaluated].sort((a, b) => b.evaluation.score - a.evaluation.score);
  const best = sorted[0];

  return {
    id: `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    contentId,
    status: "completed",
    variants: evaluated,
    winner: best
      ? {
          variantId: best.id,
          score: best.evaluation.score,
          reason: `Simulert vinner på høyest SEO/CRO-blend (${best.evaluation.score}). Ingen faktisk A/B-trafikk.`,
        }
      : undefined,
    simulated: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * When `variants` omitted, generates proposals first. Simulated evaluation only — no CMS / no publish.
 */
export async function createExperiment(
  contentId: string,
  content: CMSContentInput,
  ctx: AiVariantRunContext,
  variants?: ProposedVariant[],
): Promise<ExperimentRecord> {
  const proposed = variants ?? (await generateVariants(content, ctx));
  return await finalizeExperiment(contentId, content, proposed);
}
