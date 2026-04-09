/**
 * Budsjettforslag ut fra ROAS — før dags-cap og clamp i {@link computeNextBudgetWithGuardrails}.
 */

import { clamp } from "@/lib/ads/clamp";
import { calculateROAS } from "@/lib/ads/roas";

export type OptimizerCampaignInput = {
  budget: number;
  spend: number;
  revenue: number;
};

/** Uten global clamp — brukes av execution for å legge på dags-max/min-endring. */
export function suggestBudgetAfterRoasMultipliers(campaign: OptimizerCampaignInput): number {
  const roas = calculateROAS(campaign);
  let newBudget = campaign.budget;
  if (roas > 3) {
    newBudget *= 1.2;
  }
  if (roas < 1) {
    newBudget *= 0.8;
  }
  return newBudget;
}

/**
 * Enkel motor (spesifikasjon): multipliser + clamp til min/max.
 */
export function optimizeBudget(campaign: OptimizerCampaignInput): number {
  return clamp(suggestBudgetAfterRoasMultipliers(campaign));
}
