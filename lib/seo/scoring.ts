/**
 * Deterministic SEO scoring engine.
 * Score (0–100) and breakdown from real page signals. No fake score gimmicks.
 * Fail-safe: invalid input yields score 0 and empty breakdown (no misleading high score).
 */

import type { PageSeoAnalysis } from "@/lib/seo/pageAnalysis";

export const SEO_SCORE_CONSTANTS = {
  RECOMMENDED_TITLE_MIN: 50,
  RECOMMENDED_TITLE_MAX: 60,
  RECOMMENDED_DESC_MIN: 155,
  RECOMMENDED_DESC_MAX: 160,
  MIN_BODY_WORDS: 50,
  KEYWORD_RELEVANCE_DEDUCTION: 5,
  CONTENT_DEPTH_DEDUCTION: 5,
} as const;

/** Per-category deduction (points lost). Lower deduction = better. */
export type SeoScoreBreakdown = {
  title: number;
  description: number;
  heading: number;
  contentDepth: number;
  imageAlt: number;
  internalLinks: number;
  faq: number;
  cta: number;
  weakCta: number;
  keywordRelevance: number;
};

export type SeoScoreInput = {
  analysis: PageSeoAnalysis | null | undefined;
  /** Primary keyword from meta.intent; used for keyword relevance. */
  primaryKeyword?: string | null;
};

export type SeoScoreResult = {
  score: number;
  totalDeduction: number;
  breakdown: SeoScoreBreakdown;
};

const EMPTY_BREAKDOWN: SeoScoreBreakdown = {
  title: 0,
  description: 0,
  heading: 0,
  contentDepth: 0,
  imageAlt: 0,
  internalLinks: 0,
  faq: 0,
  cta: 0,
  weakCta: 0,
  keywordRelevance: 0,
};

/** Safe default when scoring fails: score 0, no misleading result. */
export function failSafeSeoScore(): SeoScoreResult {
  return {
    score: 0,
    totalDeduction: 100,
    breakdown: { ...EMPTY_BREAKDOWN },
  };
}

function isAnalysisValid(a: PageSeoAnalysis | null | undefined): a is PageSeoAnalysis {
  return a != null && typeof a === "object" && typeof a.blocksAnalyzed === "number";
}

/** Normalize for keyword-in-text check (lowercase, trim). */
function keywordAppearsIn(keyword: string, title: string, firstHeading: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return true;
  const t = (title || "").trim().toLowerCase();
  const h = (firstHeading || "").trim().toLowerCase();
  return t.includes(k) || h.includes(k);
}

/**
 * Compute deterministic SEO score (0–100) and breakdown from page analysis.
 * Score updates when content changes (same analysis => same score).
 * Invalid or null analysis returns fail-safe result (score 0).
 */
export function computeSeoScore(input: SeoScoreInput): SeoScoreResult {
  const { analysis, primaryKeyword } = input;
  if (!isAnalysisValid(analysis)) {
    return failSafeSeoScore();
  }

  const a = analysis;
  const breakdown: SeoScoreBreakdown = {
    title: 0,
    description: 0,
    heading: 0,
    contentDepth: 0,
    imageAlt: 0,
    internalLinks: 0,
    faq: 0,
    cta: 0,
    weakCta: 0,
    keywordRelevance: 0,
  };

  const {
    RECOMMENDED_TITLE_MIN,
    RECOMMENDED_TITLE_MAX,
    RECOMMENDED_DESC_MIN,
    RECOMMENDED_DESC_MAX,
    MIN_BODY_WORDS,
    CONTENT_DEPTH_DEDUCTION,
    KEYWORD_RELEVANCE_DEDUCTION,
  } = SEO_SCORE_CONSTANTS;

  // —— Title ——
  const titleLen = (a.title || "").length;
  if (titleLen === 0) breakdown.title = 25;
  else if (titleLen < RECOMMENDED_TITLE_MIN) breakdown.title = 15;
  else if (titleLen > RECOMMENDED_TITLE_MAX) breakdown.title = 10;

  // —— Description ——
  const descLen = (a.description || "").length;
  if (descLen === 0) breakdown.description = 25;
  else if (descLen < RECOMMENDED_DESC_MIN) breakdown.description = 12;
  else if (descLen > RECOMMENDED_DESC_MAX) breakdown.description = 5;

  // —— Heading structure ——
  const firstHeading = (a.firstHeading || "").trim();
  if (firstHeading.length > 60) breakdown.heading = 8;
  else if (a.blocksAnalyzed > 0 && !firstHeading) breakdown.heading = 5;

  // —— Content depth ——
  if (a.blocksAnalyzed >= 1 && a.bodyWordCount < MIN_BODY_WORDS) {
    breakdown.contentDepth = CONTENT_DEPTH_DEDUCTION;
  }

  // —— Image alt presence ——
  const imagesMissingAlt = a.imageAlts.filter((x) => x.empty);
  if (imagesMissingAlt.length > 0) {
    breakdown.imageAlt = Math.min(5 * imagesMissingAlt.length, 15);
  }

  // —— Internal links ——
  if (a.blocksAnalyzed >= 2 && !a.hasInternalLinks) breakdown.internalLinks = 5;

  // —— FAQ ——
  if (!a.hasFaq && a.blocksAnalyzed >= 1) breakdown.faq = 8;

  // —— CTA ——
  if (!a.hasCta && a.blocksAnalyzed >= 1) breakdown.cta = 10;
  else if (a.hasCta) {
    const weak =
      !a.ctaButtonLabel ||
      a.ctaButtonLabel.toLowerCase() === "klikk her" ||
      a.ctaButtonLabel.toLowerCase() === "click here" ||
      !a.ctaTitle;
    if (weak) breakdown.weakCta = 8;
  }

  // —— Keyword/topic relevance (only when primary keyword is set) ——
  const kw = typeof primaryKeyword === "string" ? primaryKeyword.trim() : "";
  if (kw && a.blocksAnalyzed >= 1 && !keywordAppearsIn(kw, a.title, a.firstHeading)) {
    breakdown.keywordRelevance = KEYWORD_RELEVANCE_DEDUCTION;
  }

  const totalDeduction =
    breakdown.title +
    breakdown.description +
    breakdown.heading +
    breakdown.contentDepth +
    breakdown.imageAlt +
    breakdown.internalLinks +
    breakdown.faq +
    breakdown.cta +
    breakdown.weakCta +
    breakdown.keywordRelevance;

  const score = Math.max(0, Math.min(100, 100 - totalDeduction));

  return {
    score,
    totalDeduction,
    breakdown,
  };
}
