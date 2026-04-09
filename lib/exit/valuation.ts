import "server-only";

import type { ExitKpi } from "./kpi";
import { getKPIs } from "./kpi";

export type ExitValuation = { value: number; multiple: number };

export function valuationFromKpi(kpi: ExitKpi): ExitValuation {
  const multiple = 4;
  const arr = typeof kpi.arr === "number" && Number.isFinite(kpi.arr) ? kpi.arr : 0;
  return { value: arr * multiple, multiple };
}

export async function getValuation(): Promise<ExitValuation> {
  const kpi = await getKPIs();
  return valuationFromKpi(kpi);
}

export async function getExitSnapshot(): Promise<{ kpi: ExitKpi; valuation: ExitValuation }> {
  const kpi = await getKPIs();
  return { kpi, valuation: valuationFromKpi(kpi) };
}
