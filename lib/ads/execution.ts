/**
 * Kontrollert budsjettberegning: dags-cap på endring + clamp — ingen auto-exec.
 */

import { budgetRules } from "@/lib/ads/rules";
import { clamp } from "@/lib/ads/clamp";
import { classifyCampaign, type CampaignPerformanceClass } from "@/lib/ads/classifier";
import { calculateROAS } from "@/lib/ads/roas";
import { suggestBudgetAfterRoasMultipliers } from "@/lib/ads/optimizer";
import { shouldPauseCampaign } from "@/lib/ads/safety";

export type RoasGuardrailResult = {
  nextBudget: number;
  roas: number;
  classification: CampaignPerformanceClass;
  pauseRecommended: boolean;
  /** Forslag før dags-cap (etter multiplikatorer, før clamp) */
  rawAfterMultipliers: number;
  /** Etter dags-max økning/reduksjon, før global clamp */
  afterDailyCap: number;
  unchanged: boolean;
};

/**
 * Beregner neste budsjett med maks ±endring per døgn og global clamp.
 * `paused` eller `pauseRecommended` → budsjett endres ikke.
 */
export function computeNextBudgetWithGuardrails(input: {
  budget: number;
  spend: number;
  revenue: number;
  paused?: boolean;
}): RoasGuardrailResult {
  const roas = calculateROAS(input);
  const classification = classifyCampaign(input);
  const pauseRecommended = shouldPauseCampaign({ roas });

  if (input.paused || pauseRecommended) {
    // Ingen budsjettjustering ved pause/kill-switch — ikke løft f.eks. 0 → min (unngå skjult økning).
    return {
      nextBudget: input.budget,
      roas,
      classification,
      pauseRecommended,
      rawAfterMultipliers: input.budget,
      afterDailyCap: input.budget,
      unchanged: true,
    };
  }

  const rawAfterMultipliers = suggestBudgetAfterRoasMultipliers(input);
  const current = input.budget;
  const baseForCap = current > 0 ? current : budgetRules.minBudget;
  const maxUp = baseForCap * (1 + budgetRules.maxDailyIncrease);
  const minAllowed = baseForCap * (1 - budgetRules.maxDailyDecrease);
  const afterDailyCap = Math.min(Math.max(rawAfterMultipliers, minAllowed), maxUp);
  const nextBudget = clamp(afterDailyCap);
  const unchanged = Math.round(nextBudget) === Math.round(clamp(current));

  return {
    nextBudget,
    roas,
    classification,
    pauseRecommended,
    rawAfterMultipliers,
    afterDailyCap,
    unchanged,
  };
}
