import type { MooNormalized } from "@/lib/moo/types";

/** Max drop on normalized retention (0..1) allowed when revenue gate passes. */
export const MAX_RETENTION_DROP = 0.05;
/** Max drop on normalized dwell (0..1) allowed when revenue gate passes. */
export const MAX_DWELL_DROP = 0.1;
/** Minimum relative gain on normalized revenue vs baseline (15%). */
export const MIN_RELATIVE_REVENUE_GAIN = 0.15;

export type GrowthSoftGateOpts = {
  minRelativeRevenueGain: number;
  maxRetentionDrop: number;
  maxDwellDrop: number;
};

export const DEFAULT_GROWTH_SOFT_GATE: GrowthSoftGateOpts = {
  minRelativeRevenueGain: MIN_RELATIVE_REVENUE_GAIN,
  maxRetentionDrop: MAX_RETENTION_DROP,
  maxDwellDrop: MAX_DWELL_DROP,
};

/**
 * Revenue-first: require ≥ `minRelativeRevenueGain` on normalized revenue vs baseline,
 * then allow bounded drops on retention (≤5%) and dwell (≤10%) on the 0..1 scale.
 */
export function isGrowthSoftWinner(
  baseline: MooNormalized,
  candidate: MooNormalized,
  opts: GrowthSoftGateOpts = DEFAULT_GROWTH_SOFT_GATE,
): boolean {
  const br = baseline.revenue;
  const cr = candidate.revenue;
  const relOk =
    br > 1e-6
      ? (cr - br) / Math.max(br, 1e-9) >= opts.minRelativeRevenueGain
      : cr - br >= opts.minRelativeRevenueGain;
  if (!relOk) return false;
  if (candidate.retention < baseline.retention - opts.maxRetentionDrop) return false;
  if (candidate.dwell < baseline.dwell - opts.maxDwellDrop) return false;
  return true;
}

/** @deprecated use {@link isGrowthSoftWinner} */
export const DEFAULT_MAX_REGRESSION_NON_REVENUE = MAX_RETENTION_DROP;

export type SoftRevenueLedOpts = {
  minRevenueGainNormalized: number;
  maxRegressionRetention: number;
  maxRegressionDwell: number;
};

/** Legacy soft gate (absolute normalized revenue delta). Prefer {@link isGrowthSoftWinner}. */
export function isSoftRevenueLedWinner(
  baseline: MooNormalized,
  candidate: MooNormalized,
  opts: SoftRevenueLedOpts,
): boolean {
  const revGain = candidate.revenue - baseline.revenue;
  if (revGain < opts.minRevenueGainNormalized) return false;
  if (candidate.retention < baseline.retention - opts.maxRegressionRetention) return false;
  if (candidate.dwell < baseline.dwell - opts.maxRegressionDwell) return false;
  return true;
}
