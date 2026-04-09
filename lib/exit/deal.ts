import "server-only";

import type { ExitKpi } from "@/lib/exit/kpi";

export type DealStructure = {
  valuation: number;
  type: "asset_sale";
};

/**
 * Illustrative deal box — not a binding offer.
 */
export function structureDeal(metrics: ExitKpi): DealStructure {
  const arr = typeof metrics.arr === "number" && Number.isFinite(metrics.arr) ? metrics.arr : 0;
  return {
    valuation: arr * 4,
    type: "asset_sale",
  };
}
