/**
 * STEP 5 — Explainable confidence nudges from measured outcomes (pure).
 */

/**
 * @param outcomeRatio after/before for a rate metric (>1 = lift)
 */
export function adjustConfidenceFromOutcome(confidence: number, outcomeRatio: number | null): number {
  if (outcomeRatio == null || !Number.isFinite(outcomeRatio)) return confidence;
  let delta = 0;
  if (outcomeRatio >= 1.05) delta = 0.04;
  else if (outcomeRatio <= 0.92) delta = -0.08;
  else if (outcomeRatio < 1) delta = -0.03;
  const next = confidence + delta;
  return Math.min(0.95, Math.max(0.35, next));
}

export function describeLearningDelta(metricBefore: number | null, metricAfter: number | null): string {
  if (metricBefore == null || metricAfter == null) return "Mangler før/etter — ingen læringsjustert konklusjon.";
  const d = (metricAfter - metricBefore) * 100;
  return `Endring ${d >= 0 ? "+" : ""}${d.toFixed(2)} prosentpoeng vs. baseline.`;
}
