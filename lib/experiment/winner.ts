/**
 * Vinner utelukkende på omsetning (A vs B). Deterministisk.
 */
export type RevenuePair = { A: number; B: number };

export function pickWinner(metrics: RevenuePair): { winner: "A" | "B"; uplift: number } {
  if (metrics.B > metrics.A) {
    return { winner: "B", uplift: metrics.B - metrics.A };
  }
  return { winner: "A", uplift: metrics.A > metrics.B ? metrics.A - metrics.B : 0 };
}
