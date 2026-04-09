import "server-only";

import { runAIAnalysis } from "@/lib/ai/engine";
import { evaluateVariant } from "@/lib/ai/evaluator";
import { metricsToRecommendations, normalizeMetrics } from "@/lib/ai/metrics";
import type { CMSContentInput } from "@/lib/ai/types";
import { generateVariants, type AiVariantRunContext, type ProposedVariant } from "@/lib/ai/variantGenerator";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function normalizeContent(content: unknown): CMSContentInput {
  if (!isPlainObject(content)) return {};
  return content as CMSContentInput;
}

export type OptimizerVariantResult = ProposedVariant & {
  evaluation: {
    score: number;
    delta: number;
    reasoning: string;
  };
};

export type VariantScoreRow = {
  variantId: string;
  score: number;
  delta: number;
  reasoning: string;
};

export type AutoOptimizationResult = {
  currentScore: number;
  improvedScore: number;
  delta: number;
  variants: OptimizerVariantResult[];
  scores: VariantScoreRow[];
  recommendations: string[];
  editorPrep: {
    suggestedImprovements: string[];
    variantPicker: Array<{
      variantId: string;
      label: string;
      hypothesis: string;
      applyMode: "manual";
    }>;
  };
};

/**
 * Suggest-only optimization pass: variants + scores + copy for approval. No persistence.
 */
export async function runAutoOptimization(
  content: unknown,
  ctx: AiVariantRunContext,
  metrics?: unknown,
): Promise<AutoOptimizationResult> {
  const base = normalizeContent(content);
  const analysis = await runAIAnalysis(base);
  const currentScore = analysis.score;

  const proposed = await generateVariants(base, ctx);
  const variants: OptimizerVariantResult[] = await Promise.all(
    proposed.map(async (p) => ({
      ...p,
      evaluation: await evaluateVariant(base, { blocks: p.blocks }),
    })),
  );

  const scores: VariantScoreRow[] = variants.map((v) => ({
    variantId: v.id,
    score: v.evaluation.score,
    delta: v.evaluation.delta,
    reasoning: v.evaluation.reasoning,
  }));

  const bestVariantScore = variants.length ? Math.max(...variants.map((v) => v.evaluation.score)) : currentScore;
  const improvedScore = Math.max(currentScore, bestVariantScore);
  const delta = improvedScore - currentScore;

  const metricRecs = metricsToRecommendations(normalizeMetrics(metrics));
  const recommendations = [
    ...metricRecs,
    ...variants
      .filter((v) => v.evaluation.delta > 0)
      .map((v) => `Variant «${v.id}» (+${v.evaluation.delta}): ${v.hypothesis}`),
    ...analysis.suggestions.slice(0, 5).map((s) => `[${s.source}] ${s.detail}`),
  ].slice(0, 24);

  const editorPrep = {
    suggestedImprovements: recommendations.slice(0, 12),
    variantPicker: variants.map((v) => ({
      variantId: v.id,
      label: v.id.replace(/_/g, " "),
      hypothesis: v.hypothesis,
      applyMode: "manual" as const,
    })),
  };

  return {
    currentScore,
    improvedScore,
    delta,
    variants,
    scores,
    recommendations,
    editorPrep,
  };
}
