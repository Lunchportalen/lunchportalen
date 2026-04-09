import type { ProfitState } from "./profitState";

export function detectProfitOpportunities(state: ProfitState): string[] {
  const ops: string[] = [];
  if (state.margin > 0.4) ops.push("SCALE_WINNERS");
  if (state.ltv > state.cac * 2 && state.cac > 0) ops.push("INCREASE_ACQUISITION");
  if (state.churn < 0.02) ops.push("EXPAND_CUSTOMER_BASE");
  return ops;
}
