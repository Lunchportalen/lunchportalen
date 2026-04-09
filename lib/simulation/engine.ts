/**
 * Scenario-simulering — heuristikk, deterministisk, ingen persistens.
 */

import { calculatePL, type PL } from "@/lib/finance/pl";

export type SimulationBase = {
  revenue: number;
  costOfGoods: number;
  adSpend: number;
};

export type ScenarioChanges = {
  increaseBudget?: boolean;
  priceIncrease?: boolean;
  priceDecrease?: boolean;
};

export type SimulationScenarioResult = SimulationBase & {
  pl: PL;
  /** Samme som pl.netProfit (eksplisitt for risiko-/UI-lag). */
  profit: number;
};

function finiteNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function simulateScenario(base: SimulationBase, changes: ScenarioChanges): SimulationScenarioResult {
  let revenue = finiteNonNeg(base.revenue);
  let adSpend = finiteNonNeg(base.adSpend);
  const costOfGoods = finiteNonNeg(base.costOfGoods);

  if (changes.increaseBudget) {
    adSpend *= 1.2;
    revenue *= 1.15;
  }
  if (changes.priceIncrease) {
    revenue *= 1.05;
  }
  if (changes.priceDecrease) {
    revenue *= 0.95;
  }

  const pl = calculatePL({ revenue, costOfGoods, adSpend });
  return {
    revenue,
    costOfGoods,
    adSpend,
    pl,
    profit: pl.netProfit,
  };
}
