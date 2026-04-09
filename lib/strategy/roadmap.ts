import type { RoadmapItem, StrategyAction } from "./types";

export function buildRoadmap(actions: StrategyAction[]): RoadmapItem[] {
  return actions.map((a, i) => ({
    priority: i + 1,
    action: a.action,
    impactEstimate: Math.round(a.impactEstimate),
    effort: a.effort,
    reason: a.reason,
    formula: a.formula,
  }));
}
