import type { BoardState } from "@/lib/ai/boardroom/boardState";

export function ceoStrategy(state: BoardState): string[] {
  const actions: string[] = [];
  if (state.growthRate < 0.1) {
    actions.push("ACCELERATE_GROWTH");
  }
  if (state.conversion < 0.03) {
    actions.push("OPTIMIZE_FUNNEL");
  }
  if (state.experiments === 0) {
    actions.push("START_EXPERIMENTS");
  }
  return actions;
}
