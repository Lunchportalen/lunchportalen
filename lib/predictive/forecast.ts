/**
 * Enkel, forklarbar omsetningsprognose — glidende snitt over historiske dager.
 */

import type { PredictiveDailyPoint } from "@/lib/predictive/types";

const MIN_DAYS = 5;
const WINDOW = 5;

export type ForecastRevenueResult = {
  /** Forventet «normal» hele dag (kr), basert på snitt av fullførte dager før i dag. */
  forecastToday: number | null;
  /** Snitt dag × 7 (heuristikk for uke, ikke kalenderuke). */
  forecastWeek: number | null;
  /** 0–1, deterministisk fra datamengde (ikke statistisk sikkerhet). */
  confidence: number;
  sufficientData: boolean;
  methodNb: string;
  /** Antall dager brukt i snitt (etter ekskludering av i dag). */
  daysUsed: number;
};

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  let s = 0;
  for (const n of nums) s += n;
  return s / nums.length;
}

/**
 * Bruker siste WINDOW dager med dato < todayIso (unngår delvis dag).
 */
export function forecastRevenue(dailyTotals: PredictiveDailyPoint[], todayIso: string): ForecastRevenueResult {
  const sorted = [...dailyTotals].sort((a, b) => a.date.localeCompare(b.date));
  const past = sorted.filter((d) => d.date < todayIso);
  const tail = past.slice(-WINDOW);
  if (past.length < MIN_DAYS) {
    return {
      forecastToday: null,
      forecastWeek: null,
      confidence: 0,
      sufficientData: false,
      methodNb: `Ikke nok data: trenger minst ${MIN_DAYS} fullførte dager før dagens dato.`,
      daysUsed: past.length,
    };
  }

  const totals = tail.map((d) => d.total);
  const avgDay = mean(totals);
  const extra = past.length - MIN_DAYS;
  const confidence = Math.min(0.75, 0.5 + Math.min(15, extra) * 0.015);

  return {
    forecastToday: Math.round(avgDay * 100) / 100,
    forecastWeek: Math.round(avgDay * 7 * 100) / 100,
    confidence: Math.round(confidence * 1000) / 1000,
    sufficientData: true,
    methodNb: `Enkel glidende snitt: gjennomsnitt omsetning siste ${tail.length} kalenderdager før ${todayIso} (aktive ordre, line_total).`,
    daysUsed: tail.length,
  };
}
