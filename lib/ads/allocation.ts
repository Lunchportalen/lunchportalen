/**
 * Budsjettallokering per konto — kun lønnsomme kampanjer (ROAS ≥ minROAS), ellers ingen tildeling.
 */

import { getActiveAccounts, type AdAccount } from "@/lib/ads/accounts";
import { guardrails } from "@/lib/ads/guardrails";

export type AllocationCampaign = {
  id: string;
  accountId: string;
  budget: number;
  spend: number;
  revenue: number;
  roas: number;
};

export type AllocationPlanItem = {
  accountId: string;
  campaignId: string;
  budget: number;
};

function isEligibleForAllocation(c: AllocationCampaign): boolean {
  if (!Number.isFinite(c.roas) || !Number.isFinite(c.budget)) return false;
  if (c.roas < guardrails.minROAS) return false;
  if (c.revenue < c.spend) return false;
  return true;
}

function sortCampaignsDeterministic(list: AllocationCampaign[]): AllocationCampaign[] {
  return [...list].sort((a, b) => {
    if (b.roas !== a.roas) return b.roas - a.roas;
    return a.id.localeCompare(b.id, "en");
  });
}

/**
 * Per aktiv konto: velg beste kvalifiserte kampanje. Aldri alloker til ROAS under {@link guardrails.minROAS}.
 */
export function allocateBudget(accounts: AdAccount[], campaigns: AllocationCampaign[]): AllocationPlanItem[] {
  const active = getActiveAccounts(accounts);
  const eligible = campaigns.filter(isEligibleForAllocation);
  const result: AllocationPlanItem[] = [];

  for (const acc of active) {
    const forAcc = sortCampaignsDeterministic(eligible.filter((c) => c.accountId === acc.id));
    const top = forAcc[0];
    if (!top) continue;
    const cap = Math.min(
      Math.max(0, acc.budget),
      Math.max(0, top.budget),
      guardrails.maxDailyBudget,
    );
    result.push({
      accountId: acc.id,
      campaignId: top.id,
      budget: Math.round(cap),
    });
  }

  return result;
}
