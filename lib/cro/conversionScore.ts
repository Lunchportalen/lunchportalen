// STATUS: KEEP

/**
 * Conversion scoring engine.
 * Evaluates: CTA visibility, headline strength, trust signals, friction.
 * Returns score 0–100. Uses CroPageAnalysis; no external API calls.
 */

import type { CroPageAnalysis } from "@/lib/cro/pageAnalysis";

export type ConversionScoreInput = {
  analysis: CroPageAnalysis | null | undefined;
};

export type ConversionScoreMetrics = {
  /** 0–100: CTA presence, position, and clarity. */
  ctaVisibility: number;
  /** 0–100: Main headline presence and strength. */
  headlineStrength: number;
  /** 0–100: Trust signals in content and meta. */
  trustSignals: number;
  /** 0–100: Low friction (short intros, not too many long paragraphs). */
  friction: number;
};

export type ConversionScoreResult = {
  score: number;
  metrics: ConversionScoreMetrics;
};

function isAnalysisValid(a: CroPageAnalysis | null | undefined): a is CroPageAnalysis {
  return (
    a != null &&
    typeof a === "object" &&
    typeof a.blocksAnalyzed === "number" &&
    Array.isArray(a.blockTypesInOrder)
  );
}

/** CTA visibility: has CTA, position (earlier = better), and clarity. 0–100. */
function metricCtaVisibility(analysis: CroPageAnalysis): number {
  if (!analysis.hasCta) return 0;

  const clarity = analysis.primaryCtaClarity;
  if (clarity === "none") return 0;
  if (clarity === "weak") return 40;

  const blockCount = analysis.blocksAnalyzed || 1;
  const firstCtaIdx = analysis.firstCtaIndex;
  const positionScore =
    firstCtaIdx != null && blockCount > 0
      ? Math.max(0, 100 - Math.round((firstCtaIdx / blockCount) * 50))
      : 70;

  return Math.min(100, 60 + Math.round(positionScore * 0.4));
}

/** Headline strength: main headline presence and clarity. 0–100. */
function metricHeadlineStrength(analysis: CroPageAnalysis): number {
  const clarity = analysis.headlineClarity;
  if (clarity === "missing") return 0;
  if (clarity === "weak") return 50;
  const headline = (analysis.mainHeadline ?? "").trim();
  if (headline.length >= 20 && headline.length <= 70) return 100;
  if (headline.length > 0) return 85;
  return 50;
}

/** Trust signals: mentions in body + meta.cro.trustSignals. 0–100. */
function metricTrustSignals(analysis: CroPageAnalysis): number {
  const mentions = analysis.trustSignalMentions ?? [];
  const meta = analysis.metaTrustSignals ?? [];
  const total = mentions.length + meta.length;
  if (total === 0) return 0;
  if (total >= 3) return 100;
  if (total >= 2) return 80;
  return 60;
}

/** Friction: inverse of friction indicators (long paragraphs, intro too short). 0–100 = low friction. */
function metricFriction(analysis: CroPageAnalysis): number {
  const longCount = analysis.longParagraphCount ?? 0;
  const introTooShort = analysis.introTooShort === true;
  const blocksAnalyzed = analysis.blocksAnalyzed ?? 0;

  if (blocksAnalyzed === 0) return 100;

  let deduction = 0;
  if (introTooShort) deduction += 25;
  if (longCount >= 3) deduction += 30;
  else if (longCount >= 2) deduction += 20;
  else if (longCount >= 1) deduction += 10;

  return Math.max(0, 100 - deduction);
}

/**
 * Computes conversion score (0–100) from CTA visibility, headline strength, trust signals, and friction.
 * Invalid or null analysis returns score 0 and zeroed metrics.
 */
export function computeConversionScore(input: ConversionScoreInput): ConversionScoreResult {
  const { analysis } = input;

  if (!isAnalysisValid(analysis)) {
    return {
      score: 0,
      metrics: {
        ctaVisibility: 0,
        headlineStrength: 0,
        trustSignals: 0,
        friction: 0,
      },
    };
  }

  const ctaVisibility = metricCtaVisibility(analysis);
  const headlineStrength = metricHeadlineStrength(analysis);
  const trustSignals = metricTrustSignals(analysis);
  const friction = metricFriction(analysis);

  const raw =
    ctaVisibility * 0.25 +
    headlineStrength * 0.25 +
    trustSignals * 0.25 +
    friction * 0.25;
  const score = Math.round(Math.max(0, Math.min(100, raw)));

  return {
    score,
    metrics: {
      ctaVisibility,
      headlineStrength,
      trustSignals,
      friction,
    },
  };
}
