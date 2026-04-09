import "server-only";

import { getRevenueAttribution } from "@/lib/revenue/aiRevenueAttribution";

export type ExitKpi = {
  revenue: number;
  arr: number;
  ltv: number;
  cac: number;
};

/**
 * Investor-style proxies from attributed AI revenue (estimate only — ikke regnskapsdata).
 */
export async function getKPIs(): Promise<ExitKpi> {
  const attribution = await getRevenueAttribution();
  let revenue = 0;
  for (const k of Object.keys(attribution)) {
    const v = attribution[k];
    revenue += typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  if (!Number.isFinite(revenue)) revenue = 0;
  const arr = revenue * 12;
  const ltv = revenue * 3;
  const cac = revenue * 0.2;
  return { revenue, arr, ltv, cac };
}
