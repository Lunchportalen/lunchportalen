/**
 * Kartlegger navngitte beslutninger til scenario-flagg (ingen sideeffekter).
 */

import { calculatePL } from "@/lib/finance/pl";
import { simulateScenario, type SimulationBase, type SimulationScenarioResult } from "@/lib/simulation/engine";

export type FinanceDecisionKind = "scale_ads" | "increase_price" | "reduce_price";

function asResult(base: SimulationBase): SimulationScenarioResult {
  const pl = calculatePL(base);
  return {
    ...base,
    pl,
    profit: pl.netProfit,
  };
}

export function simulateDecision(
  decision: FinanceDecisionKind | string,
  context: SimulationBase,
): SimulationScenarioResult {
  if (decision === "scale_ads") {
    return simulateScenario(context, { increaseBudget: true });
  }
  if (decision === "increase_price") {
    return simulateScenario(context, { priceIncrease: true });
  }
  if (decision === "reduce_price") {
    return simulateScenario(context, { priceDecrease: true });
  }
  return asResult(context);
}

/** Støttetype for UI: ukjent beslutningsstreng → basis P&L uten scenario. */
export function isFinanceDecisionKind(d: string): d is FinanceDecisionKind {
  return d === "scale_ads" || d === "increase_price" || d === "reduce_price";
}
