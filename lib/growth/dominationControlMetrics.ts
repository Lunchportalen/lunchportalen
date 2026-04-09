import "server-only";

import type { ControlTowerData } from "@/lib/controlTower/types";

export type DominationViewMetrics = {
  topFormat: string | null;
  best: number;
  cities: number;
  explain: string[];
};

/**
 * Visningsproxy — ingen rå konkurrentdata; kun aggregerte signaler fra Control Tower.
 */
export function buildDominationMetrics(ct: ControlTowerData): DominationViewMetrics {
  const explain: string[] = [];

  const topFormat: string | null = ct.predictive.dataAvailable
    ? ct.predictive.trend.direction === "up"
      ? "story"
      : ct.predictive.trend.direction === "down"
        ? "short"
        : "hybrid"
    : null;

  const share = ct.performance.aiAttributedShareWeek ?? 0;
  const revBoost = ct.performance.topPostRevenue > 0 ? Math.min(40, Math.log10(ct.performance.topPostRevenue + 1) * 12) : 0;
  const best = Math.round(Math.min(100, revBoost + share * 60));

  const cities =
    ct.revenue.weekTotal > 0
      ? Math.min(24, Math.max(1, Math.floor(ct.revenue.ordersCountedWeek / 4) + 1))
      : 0;

  explain.push("Toppformat er en proxy fra prognosetrend — ikke ekstern SoMe-skraping.");
  explain.push("Innholdsscore kombinerer toppost-omsetning og AI-attribuert andel (uke).");
  explain.push('"Byer aktive" er en enkel vekstproxy fra ordrevolum — erstatt med faktisk geo når tilgjengelig.');

  return {
    topFormat,
    best,
    cities,
    explain,
  };
}
