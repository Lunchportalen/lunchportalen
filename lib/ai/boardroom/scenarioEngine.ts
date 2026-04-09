import type { BoardState } from "@/lib/ai/boardroom/boardState";

export type BoardScenarios = {
  bestCase: { revenue: number; growth: number };
  worstCase: { revenue: number; churn: number };
  expected: { revenue: number };
};

function fin(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e6) / 1e6;
}

export function simulateScenarios(state: BoardState): BoardScenarios {
  const r = Number.isFinite(state.revenue) ? state.revenue : 0;
  const g = Number.isFinite(state.growthRate) ? state.growthRate : 0;
  const c = Number.isFinite(state.churn) ? state.churn : 0;
  return {
    bestCase: {
      revenue: fin(r * 1.5),
      growth: fin(g * 1.3),
    },
    worstCase: {
      revenue: fin(r * 0.7),
      churn: fin(c * 1.5),
    },
    expected: {
      revenue: fin(r * 1.1),
    },
  };
}
