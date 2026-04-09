import type { ProfitState } from "./profitState";

export function detectProfitLeaks(state: ProfitState): string[] {
  const leaks: string[] = [];
  if (state.margin < 0.2) leaks.push("LOW_MARGIN");
  if (state.cac > state.ltv && state.ltv > 0) leaks.push("NEGATIVE_UNIT_ECONOMICS");
  if (state.churn > 0.05) leaks.push("HIGH_CHURN");
  if (state.profit < 0) leaks.push("NEGATIVE_PROFIT");
  return leaks;
}
