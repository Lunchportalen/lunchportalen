/**
 * Dagsbudsjett-tak — samme sannhet som ads-guardrails.
 */

import { guardrails } from "@/lib/ads/guardrails";

export function enforceDailyLimits(campaign: { budget: number }): number {
  const b = typeof campaign.budget === "number" && Number.isFinite(campaign.budget) ? campaign.budget : 0;
  if (b > guardrails.maxDailyBudget) return guardrails.maxDailyBudget;
  return b;
}
