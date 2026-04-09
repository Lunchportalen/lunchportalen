import "server-only";

import type { ControlTowerData } from "@/lib/controlTower/types";
import type { CollectMetricsResult } from "@/lib/autopilot/collectMetrics";

export type InvestorSnapshot = {
  revenue: number;
  /** Normalized trend signal −1..1 from Control Tower (not a guarantee of future growth). */
  growthRate: number | null;
  conversionRate: number;
  experimentsRunning: number;
  revenuePerSession: number;
  /** Forecast confidence 0..1 as “lift potential” proxy (not a promise). */
  predictedLift: number | null;
  /** AI decisions logged in window (Control Tower aggregate). */
  autonomousActions: number;
  explain: string[];
};

export function buildInvestorSnapshot(args: {
  controlTower: ControlTowerData;
  autopilotMetrics: CollectMetricsResult;
  experimentsRunning: number;
}): InvestorSnapshot {
  const { controlTower: ct, autopilotMetrics: am, experimentsRunning } = args;
  const explain: string[] = [];

  const revenue = ct.revenue.weekTotal;
  let conversionRate = 0;
  let revenuePerSession = 0;

  if (am.ok) {
    conversionRate = am.metrics.conversionRate;
    revenuePerSession = am.metrics.revenue / Math.max(am.metrics.sessions, 1);
    explain.push("Konvertering og RPS fra faktiske ordre + session-proxy (visninger).");
  } else {
    const o = Math.max(1, ct.revenue.ordersCountedWeek);
    conversionRate = ct.revenue.ordersCountedWeek / o;
    revenuePerSession = revenue / o;
    explain.push("Autopilot-metrikk utilgjengelig — bruker forenklet ukesnitt.");
  }

  let growthRate: number | null = null;
  if (ct.predictive.dataAvailable && ct.predictive.trend) {
    const d = ct.predictive.trend.direction;
    const s = Math.max(0, Math.min(1, ct.predictive.trend.strength));
    growthRate = d === "up" ? s : d === "down" ? -s : 0;
    explain.push(`Trend: ${d} (styrke ${s.toFixed(2)}) — forklaring: ${ct.predictive.trend.explainNb}`);
  } else {
    explain.push(ct.predictive.insufficientDataMessage ?? "Begrenset prediktivt datagrunnlag.");
  }

  let predictedLift: number | null = null;
  if (ct.predictive.forecast?.sufficientData) {
    predictedLift = Math.max(0, Math.min(1, ct.predictive.forecast.confidence));
    explain.push("predictedLift = prognosekonfidens (0–1), ikke garantert konverteringsløft.");
  } else {
    explain.push("predictedLift utilgjengelig — utilstrekkelig prognosedata.");
  }

  const autonomousActions = typeof ct.ai.decisions24h === "number" ? ct.ai.decisions24h : 0;

  return {
    revenue,
    growthRate,
    conversionRate,
    experimentsRunning,
    revenuePerSession,
    predictedLift,
    autonomousActions,
    explain,
  };
}
