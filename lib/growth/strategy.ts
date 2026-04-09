import type { ScalingAction } from "@/lib/growth/scaleDecision";

export type StrategyRow = ScalingAction & {
  suggestedBudget: number;
};

export function buildStrategy(actions: ScalingAction[], allocation: Record<string, number>): StrategyRow[] {
  const list = Array.isArray(actions) ? actions : [];
  return list.map((a) => ({
    ...a,
    suggestedBudget: Math.round(allocation[a.channel] ?? 0),
  }));
}
