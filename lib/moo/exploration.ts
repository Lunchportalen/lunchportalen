/**
 * Adaptive exploration split for A/B/C traffic (deterministic).
 * Low data → more traffic to B+C; high data → protect baseline A.
 */

export type ExplorationBand = "low" | "medium" | "high";

/** Baseline A weight and combined B+C explore share (B and C split equally within explore). */
export function getExplorationWeights(band: ExplorationBand): { wA: number; wB: number; wC: number } {
  switch (band) {
    case "low":
      return { wA: 0.6, wB: 0.2, wC: 0.2 };
    case "high":
      return { wA: 0.9, wB: 0.05, wC: 0.05 };
    case "medium":
    default:
      return { wA: 0.8, wB: 0.1, wC: 0.1 };
  }
}

/**
 * Map total impressions vs reference to band (same shape as confidence ratio).
 */
export function explorationBandFromImpressions(args: {
  totalImpressions: number;
  minPerVariant: number;
  variantCount: number;
}): ExplorationBand {
  const k = Math.max(1, args.variantCount);
  const refTotal = args.minPerVariant * k;
  const ratio = refTotal > 0 ? args.totalImpressions / refTotal : 0;
  if (ratio < 1.2) return "low";
  if (ratio > 3) return "high";
  return "medium";
}

/** Heuristic band from 7d prod page views (no experiment yet). */
export function explorationBandFromPageViews7d(pageViews7d: number): ExplorationBand {
  if (pageViews7d < 100) return "low";
  if (pageViews7d > 500) return "high";
  return "medium";
}
