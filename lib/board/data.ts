import "server-only";

import { getKPIs } from "@/lib/exit/kpi";
import { getAiRevenueForecast } from "@/lib/revenue/aiRevenueForecast";

export type BoardSnapshot = {
  arr: number;
  revenue: number;
  ltv: number;
  forecast: number;
  forecastCurrent: number;
};

/**
 * Executive snapshot (proxy — ikke revidert regnskap). Forecast fra AI revenue-motor.
 */
export async function getBoardData(): Promise<BoardSnapshot> {
  const kpi = await getKPIs();
  const fc = await getAiRevenueForecast();
  const projected = typeof fc.projected === "number" && Number.isFinite(fc.projected) ? fc.projected : 0;
  const current = typeof fc.current === "number" && Number.isFinite(fc.current) ? fc.current : 0;
  return {
    arr: kpi.arr,
    revenue: kpi.revenue,
    ltv: kpi.ltv,
    forecast: projected,
    forecastCurrent: current,
  };
}
