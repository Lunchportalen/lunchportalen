import "server-only";

import type { ControlTowerData } from "@/lib/controlTower/types";
import { calculateCAC } from "@/lib/revenue/cac";
import { calculateLTV } from "@/lib/revenue/ltv";

export type ScaleEngineViewMetrics = {
  cac: number | null;
  ltv: number | null;
  spend: number;
  revenue: number;
  explain: string[];
};

/**
 * Visningsproxy for Control Tower — ikke full regnskaps-LTV uten churn-kilde.
 */
export function buildScaleEngineMetrics(ct: ControlTowerData): ScaleEngineViewMetrics {
  const explain: string[] = [];
  const spend = ct.finance.inputs.adSpend;
  const revenue = ct.revenue.weekTotal;
  const orders = Math.max(1, ct.revenue.ordersCountedWeek);

  const cac = calculateCAC(spend, orders);
  const arpu = revenue / orders;
  const churn = 0.05;
  const ltv = calculateLTV(arpu, churn);

  explain.push("CAC ≈ annonsespend / antall ordre (uke) — proxy til kundetelling er koblet.");
  explain.push("LTV bruker ARPU (uke) og antatt månedlig churn 5 % — erstatt med faktisk churn når tilgjengelig.");

  return {
    cac: spend > 0 ? cac : null,
    ltv,
    spend,
    revenue,
    explain,
  };
}
