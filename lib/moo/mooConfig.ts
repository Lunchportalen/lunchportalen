/**
 * Deterministic MOO / growth tuning (env overrides, safe defaults).
 */

export function getMooMinImpressionsPerVariant(): number {
  const raw = process.env.LP_MOO_MIN_IMPRESSIONS_PER_VARIANT;
  const n = raw != null && String(raw).trim() ? Number.parseInt(String(raw).trim(), 10) : NaN;
  if (Number.isFinite(n) && n >= 5 && n <= 500) return n;
  return 30;
}

/** Last N revenue attributions used for consistency check (deterministic). */
export function getMooConsistencyRevenueRows(): number {
  const raw = process.env.LP_MOO_CONSISTENCY_REVENUE_ROWS;
  const n = raw != null && String(raw).trim() ? Number.parseInt(String(raw).trim(), 10) : NaN;
  if (Number.isFinite(n) && n >= 3 && n <= 20) return n;
  return 5;
}

/** High-traffic threshold (page views in window) → 24h cooldown; below → 1h. */
export function getHighTrafficPageViewThreshold(): number {
  const raw = process.env.LP_MOO_HIGH_TRAFFIC_PAGE_VIEWS;
  const n = raw != null && String(raw).trim() ? Number.parseInt(String(raw).trim(), 10) : NaN;
  if (Number.isFinite(n) && n >= 10) return n;
  return 200;
}
