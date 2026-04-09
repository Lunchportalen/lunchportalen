import "server-only";

import { getKPIs } from "@/lib/exit/kpi";

export type FinancialReport = {
  revenue: number;
  arr: number;
  ltv: number;
  cac: number;
  margin: number;
};

/**
 * Board-style proxy rapport (deterministisk — ikke revidert regnskap).
 */
export async function getFinancialReport(): Promise<FinancialReport> {
  const kpi = await getKPIs();
  const revenue = Number.isFinite(kpi.revenue) ? kpi.revenue : 0;
  const margin = revenue * 0.6;
  return {
    revenue: kpi.revenue,
    arr: kpi.arr,
    ltv: kpi.ltv,
    cac: kpi.cac,
    margin: Number.isFinite(margin) ? margin : 0,
  };
}
