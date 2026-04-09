import type { StrategyBoostMap } from "@/lib/learning/boosts";

import type { StrategyAction } from "./types";

const sevWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Sort by boosted impact (deterministic multipliers from persisted learning).
 */
export function prioritize(actions: StrategyAction[], boosts?: StrategyBoostMap): StrategyAction[] {
  const w = boosts ?? {};
  return [...actions].sort((a, b) => {
    const ai = a.impactEstimate * (w[a.action] ?? 1);
    const bi = b.impactEstimate * (w[b.action] ?? 1);
    if (bi !== ai) return bi - ai;
    return (sevWeight[b.severity] ?? 0) - (sevWeight[a.severity] ?? 0);
  });
}
