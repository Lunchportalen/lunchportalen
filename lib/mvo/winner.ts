import type { MvoComboMetrics } from "./types";

/**
 * Velger beste combo utelukkende på omsetning (deterministisk sortering ved lik inntekt: leksikografisk nøkkel).
 */
export function pickBestCombo(
  metrics: Record<string, MvoComboMetrics>
): [string, MvoComboMetrics] | null {
  const entries = Object.entries(metrics);
  if (entries.length === 0) return null;

  entries.sort((a, b) => {
    const dr = b[1].revenue - a[1].revenue;
    if (dr !== 0) return dr;
    return a[0].localeCompare(b[0]);
  });

  return entries[0] ?? null;
}
