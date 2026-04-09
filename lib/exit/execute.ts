import "server-only";

import { contactBuyers } from "@/lib/exit/outreach";
import { structureDeal } from "@/lib/exit/deal";
import type { ExitKpi } from "@/lib/exit/kpi";

export type ExitRunResult = {
  status: "ready_for_buyers";
  deal: ReturnType<typeof structureDeal>;
  buyerOutreach: string;
};

/**
 * M&A preparation bundle — no transactions executed.
 */
export async function runExit(metrics: ExitKpi): Promise<ExitRunResult> {
  const deal = structureDeal(metrics);
  const buyerOutreach = await contactBuyers();

  console.log("[EXECUTION]", { stage: "exit", arr: metrics.arr, valuation: deal.valuation });

  return {
    status: "ready_for_buyers",
    deal,
    buyerOutreach,
  };
}
