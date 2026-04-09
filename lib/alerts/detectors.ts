/**
 * Regelbaserte detektorer — ingen ML, full sporbarhet.
 */

import type { AlertSeed, FinancialAlertRunInput } from "@/lib/alerts/types";

export function detectProfitDrop(current: number, previous: number): AlertSeed | null {
  if (!previous || previous === 0) return null;
  if (!Number.isFinite(current)) return null;
  const change = (current - previous) / previous;
  if (change < -0.3) {
    return {
      type: "profit_drop",
      severity: "high",
      message: "Profit har falt mer enn 30 %",
      context: { current, previous, change, basis: "profit" },
    };
  }
  return null;
}

/**
 * Når daglig profit ikke finnes: samme terskel på daglig omsetning mot i går.
 */
export function detectRevenueDayDropProxy(today: number, yesterday: number): AlertSeed | null {
  if (!yesterday || yesterday === 0) return null;
  if (!Number.isFinite(today)) return null;
  const change = (today - yesterday) / yesterday;
  if (change < -0.3) {
    return {
      type: "profit_drop",
      severity: "high",
      message: "Daglig omsetning har falt mer enn 30 % mot i går (indikator for resultatpress).",
      context: { today, yesterday, change, basis: "revenue_day_over_day" },
    };
  }
  return null;
}

/**
 * Ingen omsetning i dag — kun etter lunsj-vindu og når vi stoler på ordredata.
 */
export function detectNoRevenue(input: Pick<FinancialAlertRunInput, "revenueToday" | "osloHour">): AlertSeed | null {
  const { revenueToday, osloHour } = input;
  if (!Number.isFinite(revenueToday)) return null;
  if (revenueToday !== 0) return null;
  if (osloHour < 14) return null;
  return {
    type: "no_revenue",
    severity: "high",
    message: "Ingen omsetning i dag (etter 14:00 Oslo)",
    context: { revenueToday, osloHour },
  };
}

export function detectHighSpendLowReturn(spend: number, revenue: number): AlertSeed | null {
  if (!Number.isFinite(spend) || !Number.isFinite(revenue)) return null;
  if (spend > 500 && revenue < spend * 0.8) {
    return {
      type: "high_spend_low_return",
      severity: "high",
      message: "Høy spend med lav avkastning",
      context: { spend, revenue },
    };
  }
  return null;
}

export function detectWinner(revenueGrowth: number): AlertSeed | null {
  if (!Number.isFinite(revenueGrowth)) return null;
  if (revenueGrowth > 0.4) {
    return {
      type: "winner_detected",
      severity: "low",
      message: "Sterk vekst – mulig vinner",
      context: { revenueGrowth },
    };
  }
  return null;
}

export function detectRoasDrop(current: number | null, previous: number | null): AlertSeed | null {
  if (current == null || previous == null || previous <= 0) return null;
  const change = (current - previous) / previous;
  if (change < -0.25) {
    return {
      type: "roas_drop",
      severity: "high",
      message: "ROAS har falt mer enn 25 % mot forrige periode",
      context: { current, previous, change },
    };
  }
  return null;
}

export function detectSuddenSpike(today: number, yesterday: number): AlertSeed | null {
  if (!yesterday || yesterday <= 0) return null;
  if (!Number.isFinite(today)) return null;
  const change = (today - yesterday) / yesterday;
  if (change > 0.5) {
    return {
      type: "sudden_spike",
      severity: "medium",
      message: "Sterk dagsøkning i omsetning mot i går — verifiser årsak (kampanje, engang, datafeil).",
      context: { today, yesterday, change },
    };
  }
  return null;
}
