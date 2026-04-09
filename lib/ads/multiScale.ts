/**
 * Skalering per konto — kun når beste kampanje har ROAS over porteføljeterskel (vinner).
 */

import type { AdAccount } from "@/lib/ads/accounts";
import type { AllocationCampaign } from "@/lib/ads/allocation";
import { guardrails } from "@/lib/ads/guardrails";

export type MultiScaleSuggestion =
  | {
      accountId: string;
      action: "scale";
      campaignId: string;
    }
  | null;

function bestCampaignForAccount(acc: AdAccount, campaigns: AllocationCampaign[]): AllocationCampaign | null {
  const list = campaigns.filter((c) => c.accountId === acc.id && Number.isFinite(c.roas));
  if (list.length === 0) return null;
  return [...list].sort((a, b) => {
    if (b.roas !== a.roas) return b.roas - a.roas;
    return a.id.localeCompare(b.id, "en");
  })[0];
}

export function scaleAcrossAccounts(accounts: AdAccount[], campaigns: AllocationCampaign[]): MultiScaleSuggestion[] {
  return accounts.map((acc) => {
    if (acc.status !== "active") return null;
    const best = bestCampaignForAccount(acc, campaigns);
    if (!best) return null;
    if (best.roas > guardrails.minRoasForMultiAccountScale) {
      return {
        accountId: acc.id,
        action: "scale" as const,
        campaignId: best.id,
      };
    }
    return null;
  });
}
