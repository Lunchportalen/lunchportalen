/**
 * Experiment scoring engine capability: scoreExperimentResults.
 * Scores A/B (or A/B/C) experiment results: conversion rate, CTR, winner recommendation,
 * and confidence level. Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "scoreExperimentResults";

const scoreExperimentResultsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Experiment scoring engine: scores experiment results from per-variant views, clicks, conversions. Returns variant scores (conversion rate, CTR), winner recommendation, confidence level, and summary. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Score experiment results input",
    properties: {
      experimentId: { type: "string", description: "Optional experiment identifier" },
      variants: {
        type: "array",
        description: "Per-variant stats: variant, views, clicks, conversions",
        items: {
          type: "object",
          required: ["variant", "views", "clicks", "conversions"],
          properties: {
            variant: { type: "string" },
            views: { type: "number" },
            clicks: { type: "number" },
            conversions: { type: "number" },
          },
        },
      },
      primaryMetric: {
        type: "string",
        description: "Metric to use for winner: conversions | clicks | views (default: conversions)",
        enum: ["conversions", "clicks", "views"],
      },
      minViewsPerVariant: {
        type: "number",
        description: "Minimum views per variant to allow winner recommendation (default: 100)",
      },
      locale: { type: "string", description: "Locale (nb | en) for summary copy" },
    },
    required: ["variants"],
  },
  outputSchema: {
    type: "object",
    description: "Scored experiment results",
    required: ["variantScores", "recommendation", "primaryMetric", "summary", "scoredAt"],
    properties: {
      experimentId: { type: "string" },
      variantScores: {
        type: "array",
        items: {
          type: "object",
          required: ["variant", "views", "clicks", "conversions", "conversionRate", "ctr", "score", "rank"],
          properties: {
            variant: { type: "string" },
            views: { type: "number" },
            clicks: { type: "number" },
            conversions: { type: "number" },
            conversionRate: { type: "number", description: "conversions / views" },
            ctr: { type: "number", description: "clicks / views" },
            score: { type: "number", description: "Value of primary metric rate for ranking" },
            rank: { type: "number", description: "1-based rank (1 = best)" },
          },
        },
      },
      recommendation: {
        type: "object",
        required: ["status", "winner", "confidence", "message"],
        properties: {
          status: { type: "string", enum: ["winner", "inconclusive"] },
          winner: { type: "string", description: "Variant name when status is winner" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          message: { type: "string" },
        },
      },
      primaryMetric: { type: "string" },
      summary: { type: "string" },
      scoredAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Scores and recommends only; does not mutate experiment data.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(scoreExperimentResultsCapability);

export type VariantInput = {
  variant: string;
  views: number;
  clicks: number;
  conversions: number;
};

export type ScoreExperimentResultsInput = {
  experimentId?: string | null;
  variants: VariantInput[];
  primaryMetric?: "conversions" | "clicks" | "views" | null;
  minViewsPerVariant?: number | null;
  locale?: "nb" | "en" | null;
};

export type VariantScore = {
  variant: string;
  views: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
  ctr: number;
  score: number;
  rank: number;
};

export type Recommendation = {
  status: "winner" | "inconclusive";
  winner: string;
  confidence: "low" | "medium" | "high";
  message: string;
};

export type ScoreExperimentResultsOutput = {
  experimentId?: string | null;
  variantScores: VariantScore[];
  recommendation: Recommendation;
  primaryMetric: "conversions" | "clicks" | "views";
  summary: string;
  scoredAt: string;
};

const DEFAULT_MIN_VIEWS = 100;
const RELATIVE_LIFT_THRESHOLD = 0.1; // 10% lift to call a winner when sample is sufficient

function safeRate(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.min(1, Math.max(0, num / denom));
}

/**
 * Scores experiment results and returns variant scores plus recommendation.
 * Deterministic; no external calls.
 */
export function scoreExperimentResults(input: ScoreExperimentResultsInput): ScoreExperimentResultsOutput {
  const variants = Array.isArray(input.variants) ? input.variants : [];
  const primaryMetric = input.primaryMetric === "clicks" || input.primaryMetric === "views" ? input.primaryMetric : "conversions";
  const minViews = typeof input.minViewsPerVariant === "number" && input.minViewsPerVariant >= 0 ? input.minViewsPerVariant : DEFAULT_MIN_VIEWS;
  const isEn = input.locale === "en";

  const normalized: VariantInput[] = variants.map((v) => ({
    variant: String(v?.variant ?? "").trim() || "unknown",
    views: Math.max(0, Number(v?.views) || 0),
    clicks: Math.max(0, Number(v?.clicks) || 0),
    conversions: Math.max(0, Number(v?.conversions) || 0),
  }));

  const variantScores: VariantScore[] = normalized.map((v) => {
    const conversionRate = safeRate(v.conversions, v.views);
    const ctr = safeRate(v.clicks, v.views);
    const score =
      primaryMetric === "conversions"
        ? conversionRate
        : primaryMetric === "clicks"
          ? ctr
          : v.views;
    return {
      variant: v.variant,
      views: v.views,
      clicks: v.clicks,
      conversions: v.conversions,
      conversionRate,
      ctr,
      score,
      rank: 0,
    };
  });

  // Sort by score desc and assign rank
  variantScores.sort((a, b) => b.score - a.score);
  variantScores.forEach((s, i) => {
    s.rank = i + 1;
  });

  const best = variantScores[0];
  const second = variantScores[1];
  const totalViews = variantScores.reduce((s, v) => s + v.views, 0);
  const allMeetMin = variantScores.every((v) => v.views >= minViews);
  const hasEnoughData = variantScores.length >= 1 && totalViews >= minViews * variantScores.length;

  let status: "winner" | "inconclusive" = "inconclusive";
  let winner = "";
  let confidence: "low" | "medium" | "high" = "low";
  let message: string;

  if (variantScores.length === 0) {
    message = isEn ? "No variant data to score." : "Ingen variantdata å score.";
  } else if (!hasEnoughData || !allMeetMin) {
    message = isEn
      ? `Collect more data (min ${minViews} views per variant recommended).`
      : `Samle mer data (min ${minViews} visninger per variant anbefalt).`;
  } else if (variantScores.length === 1) {
    status = "winner";
    winner = best.variant;
    confidence = best.views >= minViews * 2 ? "medium" : "low";
    message = isEn ? `Single variant: ${best.variant}.` : `Én variant: ${best.variant}.`;
  } else {
    const lift = second && best.score > 0 ? (best.score - second.score) / best.score : 0;
    if (lift >= RELATIVE_LIFT_THRESHOLD && best.views >= minViews) {
      status = "winner";
      winner = best.variant;
      const pct = Math.round(lift * 100);
      confidence = lift >= 0.2 && totalViews >= 500 ? "high" : lift >= 0.15 ? "medium" : "low";
      message = isEn
        ? `${best.variant} leads by ${pct}% on ${primaryMetric}. Consider declaring winner.`
        : `${best.variant} leder med ${pct}% på ${primaryMetric}. Vurder å erklære vinner.`;
    } else {
      message = isEn
        ? "Difference between variants is small or sample size low. Run longer or collect more traffic."
        : "Forskjell mellom varianter er liten eller utvalget er lite. Kjør lenger eller samle mer trafikk.";
    }
  }

  if (status === "winner" && winner === "" && best) {
    winner = best.variant;
  }

  const recommendation: Recommendation = {
    status,
    winner,
    confidence,
    message,
  };

  const summary =
    variantScores.length === 0
      ? (isEn ? "No scores." : "Ingen scoring.")
      : isEn
        ? `${variantScores.length} variant(s) scored on ${primaryMetric}. ${recommendation.message}`
        : `${variantScores.length} variant(er) scoret på ${primaryMetric}. ${recommendation.message}`;

  return {
    experimentId: input.experimentId ?? undefined,
    variantScores,
    recommendation,
    primaryMetric,
    summary,
    scoredAt: new Date().toISOString(),
  };
}

export { scoreExperimentResultsCapability, CAPABILITY_NAME };
