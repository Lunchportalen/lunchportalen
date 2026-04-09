import type { MarketSimulation } from "@/lib/ai/marketSimulationEngine";

export type OmniscientDecisionAction =
  | { type: "MARKET_MOVE"; data: MarketSimulation }
  | { type: "EXPANSION"; data: string };

/**
 * Builds an explainable action list for audit / downstream hints. Not an execution contract.
 */
export function decideOmniscientActions(
  ranked: MarketSimulation[],
  expansion: string[],
): OmniscientDecisionAction[] {
  const actions: OmniscientDecisionAction[] = [];
  if (ranked[0]) {
    actions.push({ type: "MARKET_MOVE", data: ranked[0] });
  }
  for (const e of expansion) {
    actions.push({ type: "EXPANSION", data: e });
  }
  return actions;
}

/**
 * Hints for Singularity / God Mode planners (strings only — never auto-executed).
 */
export function buildOmniscientFeedForGrowthEngines(
  ranked: MarketSimulation[],
  expansion: string[],
): { hints: string[] } {
  const hints: string[] = [];
  const top = ranked[0];
  if (top?.type === "FUNNEL_OPTIMIZATION") {
    hints.push("HINT_OMNISCIENT_FUNNEL_OPTIMIZE");
  }
  if (top?.type === "PRICE_UP" || top?.type === "PRICE_DOWN") {
    hints.push("HINT_OMNISCIENT_PRICING_SIMULATION_ONLY");
  }
  for (const e of expansion) {
    hints.push(`HINT_EXPANSION:${e}`);
  }
  return { hints };
}
