/**
 * AI content quality score (AIContentScore).
 * Composite 0–100 metric from SEO and CRO scores. Deterministic, traceable.
 * No external API calls.
 */

export type AiContentScoreInput = {
  /** SEO score 0–100 (e.g. from AiSeoScore / SEO intelligence). */
  seoScore?: number | null;
  /** CRO score 0–100 (e.g. from ConversionScore / CRO analysis). */
  croScore?: number | null;
};

export type AiContentScoreResult = {
  /** Overall AI content quality score 0–100. */
  score: number;
  /** Whether the score is based on both inputs (true) or a single one (false). */
  hasBothInputs: boolean;
};

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Computes AIContentScore (0–100) from SEO and CRO scores.
 * - If both are provided: average (50% SEO, 50% CRO).
 * - If only one is provided: use that score.
 * - If neither: return 0.
 */
export function computeAiContentScore(input: AiContentScoreInput): AiContentScoreResult {
  const seo = input.seoScore;
  const cro = input.croScore;
  const hasSeo = typeof seo === "number" && !Number.isNaN(seo);
  const hasCro = typeof cro === "number" && !Number.isNaN(cro);

  if (hasSeo && hasCro) {
    const raw = (clampScore(seo) + clampScore(cro)) / 2;
    return { score: Math.round(raw), hasBothInputs: true };
  }
  if (hasSeo) {
    return { score: clampScore(seo), hasBothInputs: false };
  }
  if (hasCro) {
    return { score: clampScore(cro), hasBothInputs: false };
  }
  return { score: 0, hasBothInputs: false };
}
