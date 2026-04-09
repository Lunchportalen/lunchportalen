/**
 * Diversifisering: ingen enkeltkampanje skal dominere budsjettet (andel > maxShare).
 */

import { guardrails } from "@/lib/ads/guardrails";
import type { AdAccount } from "@/lib/ads/accounts";

export type DiversifiedCampaign<T extends { id: string; budget: number }> = T & {
  share: number;
  capped: boolean;
  suggestedMaxBudget: number;
};

/**
 * @param maxShare — andel av total porteføljebudsjett (0–1). Standard fra guardrails.
 */
export function diversify<T extends { id: string; budget: number }>(
  _accounts: AdAccount[],
  campaigns: T[],
  maxShare: number = guardrails.maxBudgetSharePerCampaign,
): DiversifiedCampaign<T>[] {
  const totalBudget = campaigns.reduce((s, c) => s + Math.max(0, c.budget), 0);
  if (totalBudget <= 0 || !Number.isFinite(totalBudget)) {
    return campaigns.map((c) => ({
      ...c,
      share: 0,
      capped: false,
      suggestedMaxBudget: Math.max(0, c.budget),
    }));
  }

  return campaigns.map((c) => {
    const b = Math.max(0, c.budget);
    const share = b / totalBudget;
    const suggestedMaxBudget = Math.round(totalBudget * maxShare);
    const capped = share > maxShare;
    return {
      ...c,
      share,
      capped,
      suggestedMaxBudget,
    };
  });
}
