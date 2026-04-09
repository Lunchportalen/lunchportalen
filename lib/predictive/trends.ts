/**
 * Trend fra sammenligning nylig vs eldre vindu (deterministisk).
 */

import type { PredictiveDailyPoint } from "@/lib/predictive/types";

export type TrendResult = {
  direction: "up" | "down" | "flat";
  /** 0–1 normalisert styrke. */
  strength: number;
  explainNb: string;
};

function sumTotals(days: PredictiveDailyPoint[]): number {
  let s = 0;
  for (const d of days) s += d.total;
  return s;
}

/**
 * Sammenligner siste 3 dager vs forrige 3 dager (kun dager ≤ todayIso sortert).
 */
export function detectTrend(dailyTotals: PredictiveDailyPoint[], todayIso: string): TrendResult {
  const sorted = [...dailyTotals].filter((d) => d.date <= todayIso).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 6) {
    return {
      direction: "flat",
      strength: 0,
      explainNb: "For få dager til trend — minst 6 kalenderdager med data kreves.",
    };
  }

  const recent = sorted.slice(-3);
  const prior = sorted.slice(-6, -3);
  const r = sumTotals(recent);
  const p = sumTotals(prior);
  const denom = Math.max(1, p, r);
  const delta = (r - p) / denom;
  const strength = Math.min(1, Math.abs(delta));

  let direction: TrendResult["direction"] = "flat";
  if (delta > 0.05) direction = "up";
  else if (delta < -0.05) direction = "down";

  return {
    direction,
    strength: Math.round(strength * 1000) / 1000,
    explainNb: `Sammenligner sum omsetning siste 3 dager (${r.toFixed(0)} kr) mot forrige 3 dager (${p.toFixed(0)} kr), normalisert nevner max(1, eldre, nyere).`,
  };
}
