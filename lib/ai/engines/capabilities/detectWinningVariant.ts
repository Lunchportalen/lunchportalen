/**
 * Winning variant detector capability: detectWinningVariant.
 * Detects whether experiment results have a clear winning variant based on
 * per-variant views, clicks, conversions. Returns hasWinner, winningVariant, confidence, reason.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "detectWinningVariant";

const detectWinningVariantCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Winning variant detector: from per-variant views, clicks, conversions, detects if there is a clear winner. Returns hasWinner, winningVariant, runnerUp, confidence, reason, and evidence. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect winning variant input",
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
        description: "Metric for detection: conversions | clicks | views (default: conversions)",
        enum: ["conversions", "clicks", "views"],
      },
      minViewsPerVariant: {
        type: "number",
        description: "Minimum views per variant to declare a winner (default: 100)",
      },
      minLiftPercent: {
        type: "number",
        description: "Minimum relative lift (0–100) of winner over runner-up (default: 10)",
      },
      locale: { type: "string", description: "Locale (nb | en) for reason copy" },
    },
    required: ["variants"],
  },
  outputSchema: {
    type: "object",
    description: "Winning variant detection result",
    required: ["hasWinner", "winningVariant", "runnerUp", "confidence", "reason", "evidence", "detectedAt"],
    properties: {
      experimentId: { type: "string" },
      hasWinner: { type: "boolean" },
      winningVariant: { type: "string", description: "Variant name when hasWinner; else empty" },
      runnerUp: { type: "string", description: "Second-best variant name if applicable" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      reason: { type: "string" },
      evidence: {
        type: "object",
        properties: {
          primaryMetric: { type: "string" },
          bestRate: { type: "number" },
          liftPercent: { type: "number" },
          totalViews: { type: "number" },
        },
      },
      detectedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Detection only; does not mutate experiment data.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(detectWinningVariantCapability);

export type VariantInput = {
  variant: string;
  views: number;
  clicks: number;
  conversions: number;
};

export type DetectWinningVariantInput = {
  experimentId?: string | null;
  variants: VariantInput[];
  primaryMetric?: "conversions" | "clicks" | "views" | null;
  minViewsPerVariant?: number | null;
  minLiftPercent?: number | null;
  locale?: "nb" | "en" | null;
};

export type WinningVariantEvidence = {
  primaryMetric: "conversions" | "clicks" | "views";
  bestRate: number;
  liftPercent: number;
  totalViews: number;
};

export type DetectWinningVariantOutput = {
  experimentId?: string | null;
  hasWinner: boolean;
  winningVariant: string;
  runnerUp: string;
  confidence: "low" | "medium" | "high";
  reason: string;
  evidence: WinningVariantEvidence;
  detectedAt: string;
};

const DEFAULT_MIN_VIEWS = 100;
const DEFAULT_MIN_LIFT_PERCENT = 10;

function safeRate(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.min(1, Math.max(0, num / denom));
}

/**
 * Detects whether there is a clear winning variant. Deterministic; no external calls.
 */
export function detectWinningVariant(input: DetectWinningVariantInput): DetectWinningVariantOutput {
  const variants = Array.isArray(input.variants) ? input.variants : [];
  const primaryMetric = input.primaryMetric === "clicks" || input.primaryMetric === "views" ? input.primaryMetric : "conversions";
  const minViews = typeof input.minViewsPerVariant === "number" && input.minViewsPerVariant >= 0 ? input.minViewsPerVariant : DEFAULT_MIN_VIEWS;
  const minLiftPercent = Math.max(0, Math.min(100, Number(input.minLiftPercent) || DEFAULT_MIN_LIFT_PERCENT));
  const isEn = input.locale === "en";

  const normalized = variants.map((v) => ({
    variant: String(v?.variant ?? "").trim() || "unknown",
    views: Math.max(0, Number(v?.views) || 0),
    clicks: Math.max(0, Number(v?.clicks) || 0),
    conversions: Math.max(0, Number(v?.conversions) || 0),
  }));

  const withScore = normalized.map((v) => {
    const rate = primaryMetric === "conversions" ? safeRate(v.conversions, v.views) : primaryMetric === "clicks" ? safeRate(v.clicks, v.views) : v.views;
    return { ...v, score: rate };
  });
  withScore.sort((a, b) => b.score - a.score);

  const best = withScore[0];
  const second = withScore[1];
  const totalViews = withScore.reduce((s, v) => s + v.views, 0);
  const allMeetMin = withScore.every((v) => v.views >= minViews);

  let hasWinner = false;
  let winningVariant = "";
  let runnerUp = second?.variant ?? "";
  let confidence: "low" | "medium" | "high" = "low";
  let reason: string;
  let bestRate = 0;
  let liftPercent = 0;

  if (withScore.length === 0) {
    reason = isEn ? "No variant data." : "Ingen variantdata.";
  } else if (withScore.length === 1) {
    if (best.views >= minViews) {
      hasWinner = true;
      winningVariant = best.variant;
      bestRate = best.score;
      confidence = best.views >= minViews * 2 ? "medium" : "low";
      reason = isEn ? `Single variant "${best.variant}" meets minimum sample.` : `Én variant «${best.variant}» oppfyller minimumsutvalg.`;
    } else {
      reason = isEn ? `Need at least ${minViews} views to declare winner.` : `Minst ${minViews} visninger nødvendig for å erklære vinner.`;
    }
  } else {
    bestRate = best.score;
    liftPercent = best.score > 0 && second ? Math.round(((best.score - second.score) / best.score) * 100) : 0;
    if (allMeetMin && liftPercent >= minLiftPercent) {
      hasWinner = true;
      winningVariant = best.variant;
      runnerUp = second.variant;
      confidence = liftPercent >= 20 && totalViews >= 500 ? "high" : liftPercent >= 15 ? "medium" : "low";
      reason = isEn
        ? `"${best.variant}" leads "${second.variant}" by ${liftPercent}% on ${primaryMetric}.`
        : `«${best.variant}» leder «${second.variant}» med ${liftPercent}% på ${primaryMetric}.`;
    } else if (!allMeetMin) {
      reason = isEn
        ? `Collect more data (min ${minViews} views per variant).`
        : `Samle mer data (min ${minViews} visninger per variant).`;
    } else {
      reason = isEn
        ? `No clear winner: lead is ${liftPercent}% (need ${minLiftPercent}% min).`
        : `Ingen tydelig vinner: ledelsen er ${liftPercent}% (min ${minLiftPercent}% krevd).`;
    }
  }

  const evidence: WinningVariantEvidence = {
    primaryMetric,
    bestRate: typeof best?.score === "number" ? best.score : 0,
    liftPercent,
    totalViews,
  };

  return {
    experimentId: input.experimentId ?? undefined,
    hasWinner,
    winningVariant,
    runnerUp,
    confidence,
    reason,
    evidence,
    detectedAt: new Date().toISOString(),
  };
}

export { detectWinningVariantCapability, CAPABILITY_NAME };
