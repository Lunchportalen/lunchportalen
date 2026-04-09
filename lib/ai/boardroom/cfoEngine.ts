import type { BoardState } from "@/lib/ai/boardroom/boardState";

export function cfoStrategy(state: BoardState): string[] {
  const actions: string[] = [];
  if (state.cac > state.ltv) {
    actions.push("CUT_ACQUISITION_COST");
  }
  if (state.churn > 0.05) {
    actions.push("REDUCE_CHURN");
  }
  if (state.burn > state.revenue && state.revenue >= 0) {
    actions.push("REDUCE_BURN");
  }
  return actions;
}
