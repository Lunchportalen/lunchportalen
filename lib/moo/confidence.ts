/**
 * Confidence-weighted aggressiveness: low sample → lower revenue bar (explore);
 * high sample → higher bar (conservative). Deterministic from impression totals.
 */

export type ConfidenceBand = "explore" | "balanced" | "conservative";

const GAIN_EXPLORE = 0.015;
const GAIN_BALANCED = 0.035;
const GAIN_CONSERVATIVE = 0.06;

/**
 * `totalImpressions` = sum of view/impression counts across all variants in the experiment window.
 * `minPerVariant` = floor required per variant (same as experiment winner threshold).
 * `variantCount` = number of active variants (e.g. 2 or 3).
 */
export function computeMinRevenueGainNormalized(args: {
  totalImpressions: number;
  minPerVariant: number;
  variantCount: number;
}): { minRevenueGainNormalized: number; band: ConfidenceBand } {
  const k = Math.max(1, args.variantCount);
  const refTotal = args.minPerVariant * k;
  const ratio = refTotal > 0 ? args.totalImpressions / refTotal : 0;

  if (ratio < 1.2) {
    return { minRevenueGainNormalized: GAIN_EXPLORE, band: "explore" };
  }
  if (ratio > 3) {
    return { minRevenueGainNormalized: GAIN_CONSERVATIVE, band: "conservative" };
  }
  return { minRevenueGainNormalized: GAIN_BALANCED, band: "balanced" };
}
