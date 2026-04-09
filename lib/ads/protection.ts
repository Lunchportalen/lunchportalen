/**
 * Dags- og kontonivå — kan mutere `campaign.budget` (kontrakt som i spesifikasjonen).
 */

import { guardrails } from "@/lib/ads/guardrails";

export function enforceCaps(campaign: { budget: number }, account: { totalSpend: number }): "ok" | "freeze" {
  if (campaign.budget > guardrails.maxDailyBudget) {
    campaign.budget = guardrails.maxDailyBudget;
  }
  if (account.totalSpend > guardrails.maxAccountBudget) {
    return "freeze";
  }
  return "ok";
}
