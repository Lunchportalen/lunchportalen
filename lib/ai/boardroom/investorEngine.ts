import type { BoardState } from "@/lib/ai/boardroom/boardState";

export function investorStrategy(state: BoardState): string[] {
  const actions: string[] = [];
  if (state.growthRate > 0.2 && state.ltv > state.cac) {
    actions.push("SCALE_AGGRESSIVELY");
  }
  if (state.runway < 6) {
    actions.push("RAISE_CAPITAL");
  }
  if (state.mrr > 100000) {
    actions.push("EXPAND_MARKET");
  }
  return actions;
}
