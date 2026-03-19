/**
 * AI SEO scoring engine.
 * Metrics: keyword coverage, heading structure, internal linking, content length.
 * Returns score 0–100. Uses PageSeoAnalysis; no external API calls.
 */

import type { PageSeoAnalysis } from "@/lib/seo/pageAnalysis";

export type AiSeoScoreInput = {
  /** Page analysis from analyzePageForSeo (or compatible shape). */
  analysis: PageSeoAnalysis | null | undefined;
  /** Primary keyword for keyword coverage (e.g. from meta.intent.primaryKeyword). */
  primaryKeyword?: string | null;
};

export type AiSeoScoreMetrics = {
  /** 0–100: keyword presence in title, heading, body. */
  keywordCoverage: number;
  /** 0–100: heading presence, count, first heading length. */
  headingStructure: number;
  /** 0–100: internal link presence and count. */
  internalLinking: number;
  /** 0–100: content length (word count) adequacy. */
  contentLength: number;
};

export type AiSeoScoreResult = {
  /** Overall score 0–100. */
  score: number;
  metrics: AiSeoScoreMetrics;
};

const MIN_BODY_WORDS_GOOD = 300;
const MIN_BODY_WORDS_OK = 100;
const MIN_HEADINGS_GOOD = 2;
const MAX_FIRST_HEADING_LEN = 70;
const INTERNAL_LINKS_GOOD = 2;
const INTERNAL_LINKS_OK = 1;

function isAnalysisValid(a: PageSeoAnalysis | null | undefined): a is PageSeoAnalysis {
  return (
    a != null &&
    typeof a === "object" &&
    Array.isArray(a.headings) &&
    typeof a.bodyWordCount === "number"
  );
}

/** Keyword coverage: primary keyword in title, first heading, or body. 0–100. */
function metricKeywordCoverage(
  analysis: PageSeoAnalysis,
  primaryKeyword: string | null
): number {
  const kw = primaryKeyword?.trim().toLowerCase() ?? "";
  if (!kw) return 100;

  const title = (analysis.title ?? "").trim().toLowerCase();
  const firstHeading = (analysis.firstHeading ?? "").trim().toLowerCase();
  const body = (analysis.bodyContent ?? "").trim().toLowerCase();

  if (title.includes(kw) && firstHeading.includes(kw)) return 100;
  if (title.includes(kw) || firstHeading.includes(kw)) return 85;
  if (body.includes(kw)) return 70;
  return 0;
}

/** Heading structure: has headings, reasonable count, first heading length. 0–100. */
function metricHeadingStructure(analysis: PageSeoAnalysis): number {
  const headings = analysis.headings ?? [];
  const first = analysis.firstHeading ?? "";
  const firstLen = first.trim().length;

  if (headings.length === 0) return 0;
  if (firstLen > MAX_FIRST_HEADING_LEN) return 50;
  if (headings.length >= MIN_HEADINGS_GOOD && firstLen <= MAX_FIRST_HEADING_LEN) return 100;
  if (headings.length >= 1) return 75;
  return 50;
}

/** Internal linking: presence and count. 0–100. */
function metricInternalLinking(analysis: PageSeoAnalysis): number {
  const count = analysis.internalLinkCount ?? 0;
  const has = analysis.hasInternalLinks === true;

  if (!has && count === 0) return 0;
  if (count >= INTERNAL_LINKS_GOOD) return 100;
  if (count >= INTERNAL_LINKS_OK) return 75;
  return 50;
}

/** Content length: body word count. 0–100. */
function metricContentLength(analysis: PageSeoAnalysis): number {
  const words = analysis.bodyWordCount ?? 0;

  if (words >= MIN_BODY_WORDS_GOOD) return 100;
  if (words >= MIN_BODY_WORDS_OK) return 70;
  if (words >= 30) return 40;
  if (words > 0) return 20;
  return 0;
}

/**
 * Computes AI SEO score (0–100) from keyword coverage, heading structure, internal linking, and content length.
 * Invalid or null analysis returns score 0 and zeroed metrics.
 */
export function computeAiSeoScore(input: AiSeoScoreInput): AiSeoScoreResult {
  const { analysis, primaryKeyword } = input;

  if (!isAnalysisValid(analysis)) {
    return {
      score: 0,
      metrics: {
        keywordCoverage: 0,
        headingStructure: 0,
        internalLinking: 0,
        contentLength: 0,
      },
    };
  }

  const keywordCoverage = metricKeywordCoverage(
    analysis,
    typeof primaryKeyword === "string" ? primaryKeyword : null
  );
  const headingStructure = metricHeadingStructure(analysis);
  const internalLinking = metricInternalLinking(analysis);
  const contentLength = metricContentLength(analysis);

  const raw =
    (keywordCoverage * 0.25 +
      headingStructure * 0.25 +
      internalLinking * 0.25 +
      contentLength * 0.25);
  const score = Math.round(Math.max(0, Math.min(100, raw)));

  return {
    score,
    metrics: {
      keywordCoverage,
      headingStructure,
      internalLinking,
      contentLength,
    },
  };
}
