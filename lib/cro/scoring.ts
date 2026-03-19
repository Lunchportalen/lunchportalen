/**
 * Deterministic CRO scoring engine.
 * Score (0–100) and breakdown from real conversion signals. No fake score gimmicks.
 * Fail-safe: invalid input yields score 0 and empty breakdown (no misleading high score).
 */

import type { CroPageAnalysis } from "@/lib/cro/pageAnalysis";

export const CRO_SCORE_CONSTANTS = {
  /** Points deducted when no CTA block. */
  MISSING_CTA_DEDUCTION: 15,
  /** Points deducted when CTA is generic/weak. */
  WEAK_CTA_DEDUCTION: 10,
  /** Points deducted when no main headline. */
  MISSING_HEADLINE_DEDUCTION: 12,
  /** Points deducted when headline too short. */
  WEAK_HEADLINE_DEDUCTION: 5,
  /** Points deducted when no value props. */
  MISSING_VALUE_PROPS_DEDUCTION: 8,
  /** Points deducted when intro is too short. */
  SHORT_INTRO_DEDUCTION: 4,
  /** Points deducted when no trust signals (and page has body). */
  NO_TRUST_SIGNALS_DEDUCTION: 6,
  /** Points per long paragraph (friction); capped. */
  FRICTION_PER_LONG_PARAGRAPH: 3,
  FRICTION_CAP: 9,
  /** Points deducted when offer is unclear. */
  UNCLEAR_OFFER_DEDUCTION: 8,
  /** Points deducted when CTA is very late in structure. */
  CTA_LATE_DEDUCTION: 4,
  /** Points deducted when too many CTAs. */
  MULTIPLE_CTAS_DEDUCTION: 3,
  /** Body length (chars) above which we expect trust signals. */
  TRUST_SIGNALS_BODY_MIN: 100,
  /** First CTA index at or above this triggers structure deduction. */
  CTA_LATE_INDEX_THRESHOLD: 5,
  /** More than this many CTAs triggers deduction. */
  MULTIPLE_CTAS_THRESHOLD: 2,
} as const;

/** Per-category deduction (points lost). Lower deduction = better. */
export type CroScoreBreakdown = {
  cta: number;
  weakCta: number;
  headline: number;
  valueProps: number;
  intro: number;
  trustSignals: number;
  friction: number;
  offerClarity: number;
  structure: number;
  multipleCtas: number;
};

export type CroScoreInput = {
  analysis: CroPageAnalysis | null | undefined;
};

export type CroScoreResult = {
  score: number;
  totalDeduction: number;
  breakdown: CroScoreBreakdown;
};

const EMPTY_BREAKDOWN: CroScoreBreakdown = {
  cta: 0,
  weakCta: 0,
  headline: 0,
  valueProps: 0,
  intro: 0,
  trustSignals: 0,
  friction: 0,
  offerClarity: 0,
  structure: 0,
  multipleCtas: 0,
};

/** Safe default when scoring fails: score 0, no misleading result. */
export function failSafeCroScore(): CroScoreResult {
  return {
    score: 0,
    totalDeduction: 100,
    breakdown: { ...EMPTY_BREAKDOWN },
  };
}

function isAnalysisValid(a: CroPageAnalysis | null | undefined): a is CroPageAnalysis {
  return a != null && typeof a === "object" && typeof a.blocksAnalyzed === "number";
}

/**
 * Compute deterministic CRO score (0–100) and breakdown from page analysis.
 * Score updates when content changes (same analysis => same score).
 * Invalid or null analysis returns fail-safe result (score 0).
 */
export function computeCroScore(input: CroScoreInput): CroScoreResult {
  const { analysis } = input;
  if (!isAnalysisValid(analysis)) {
    return failSafeCroScore();
  }

  const a = analysis;
  const breakdown: CroScoreBreakdown = {
    cta: 0,
    weakCta: 0,
    headline: 0,
    valueProps: 0,
    intro: 0,
    trustSignals: 0,
    friction: 0,
    offerClarity: 0,
    structure: 0,
    multipleCtas: 0,
  };

  const {
    MISSING_CTA_DEDUCTION,
    WEAK_CTA_DEDUCTION,
    MISSING_HEADLINE_DEDUCTION,
    WEAK_HEADLINE_DEDUCTION,
    MISSING_VALUE_PROPS_DEDUCTION,
    SHORT_INTRO_DEDUCTION,
    NO_TRUST_SIGNALS_DEDUCTION,
    FRICTION_PER_LONG_PARAGRAPH,
    FRICTION_CAP,
    UNCLEAR_OFFER_DEDUCTION,
    CTA_LATE_DEDUCTION,
    MULTIPLE_CTAS_DEDUCTION,
    TRUST_SIGNALS_BODY_MIN,
    CTA_LATE_INDEX_THRESHOLD,
    MULTIPLE_CTAS_THRESHOLD,
  } = CRO_SCORE_CONSTANTS;

  // —— CTA presence ——
  if (a.blocksAnalyzed > 0 && a.primaryCtaClarity === "none") {
    breakdown.cta = MISSING_CTA_DEDUCTION;
  }

  // —— CTA clarity (weak label/title) ——
  if (a.primaryCtaClarity === "weak") {
    breakdown.weakCta = WEAK_CTA_DEDUCTION;
  }

  // —— Headline ——
  if (a.blocksAnalyzed > 0) {
    if (a.headlineClarity === "missing") {
      breakdown.headline = MISSING_HEADLINE_DEDUCTION;
    } else if (a.headlineClarity === "weak") {
      breakdown.headline = WEAK_HEADLINE_DEDUCTION;
    }
  }

  // —— Value proposition ——
  if (a.blocksAnalyzed >= 1 && !a.hasValueProps) {
    breakdown.valueProps = MISSING_VALUE_PROPS_DEDUCTION;
  }

  // —— Intro length ——
  if (a.introTooShort && a.introWordCount > 0) {
    breakdown.intro = SHORT_INTRO_DEDUCTION;
  }

  // —— Trust signals (only when page has substantial body) ——
  if (
    a.trustSignalMentions.length === 0 &&
    a.metaTrustSignals.length === 0 &&
    a.bodyContent.trim().length >= TRUST_SIGNALS_BODY_MIN
  ) {
    breakdown.trustSignals = NO_TRUST_SIGNALS_DEDUCTION;
  }

  // —— Friction (long paragraphs) ——
  if (a.longParagraphCount > 0) {
    breakdown.friction = Math.min(
      FRICTION_CAP,
      a.longParagraphCount * FRICTION_PER_LONG_PARAGRAPH
    );
  }

  // —— Offer clarity ——
  if (a.blocksAnalyzed >= 1 && !a.hasExplicitOffer) {
    breakdown.offerClarity = UNCLEAR_OFFER_DEDUCTION;
  } else if (a.hasCta && !a.offerInCtaLabel) {
    breakdown.offerClarity = UNCLEAR_OFFER_DEDUCTION;
  }

  // —— Structure (CTA very late) ——
  if (
    a.firstCtaIndex != null &&
    a.firstCtaIndex >= CTA_LATE_INDEX_THRESHOLD &&
    a.blocksAnalyzed > CTA_LATE_INDEX_THRESHOLD
  ) {
    breakdown.structure = CTA_LATE_DEDUCTION;
  }

  // —— Multiple CTAs ——
  if (a.ctaCount > MULTIPLE_CTAS_THRESHOLD) {
    breakdown.multipleCtas = MULTIPLE_CTAS_DEDUCTION;
  }

  const totalDeduction =
    breakdown.cta +
    breakdown.weakCta +
    breakdown.headline +
    breakdown.valueProps +
    breakdown.intro +
    breakdown.trustSignals +
    breakdown.friction +
    breakdown.offerClarity +
    breakdown.structure +
    breakdown.multipleCtas;

  const score = Math.max(0, Math.min(100, 100 - totalDeduction));

  return {
    score,
    totalDeduction,
    breakdown,
  };
}
