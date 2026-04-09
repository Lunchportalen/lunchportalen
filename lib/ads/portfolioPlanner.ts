/**
 * Porteføljeplanlegger: allokering, rotasjon, risiko, skalering — ren beregning + policy.
 * Ingen auto-exec; godkjenning for spend følger eksisterende ads-flyt.
 */

import type { AdAccount } from "@/lib/ads/accounts";
import { allocateBudget, type AllocationCampaign } from "@/lib/ads/allocation";
import { resolveAccountControlState, type PortfolioRoasPolicy } from "@/lib/ads/account";
import type { Creative } from "@/lib/ads/creatives";
import { getActiveCreatives } from "@/lib/ads/creatives";
import { getPortfolioMetrics } from "@/lib/ads/portfolio";
import type { MultiScaleSuggestion } from "@/lib/ads/multiScale";
import { scaleAcrossAccounts } from "@/lib/ads/multiScale";
import { diversify } from "@/lib/ads/risk";
import { rotateCreatives } from "@/lib/ads/rotation";
import { assignCreativeVariants, type CreativeVariantAssignment } from "@/lib/ads/testing";

export type PortfolioPlannerInput = {
  accounts: AdAccount[];
  campaigns: AllocationCampaign[];
  creatives: Creative[];
};

export type PortfolioPlannerResult = {
  metrics: ReturnType<typeof getPortfolioMetrics>;
  portfolioPolicy: PortfolioRoasPolicy;
  accountResolution: ReturnType<typeof resolveAccountControlState>;
  allocationBase: ReturnType<typeof allocateBudget>;
  allocationFinal: ReturnType<typeof allocateBudget>;
  rotationOrder: Creative[];
  creativeVariantsByCampaign: Array<{ campaignId: string; variants: CreativeVariantAssignment[] }>;
  diversified: ReturnType<typeof diversify<AllocationCampaign>>;
  scalingSuggestions: MultiScaleSuggestion[];
  scalingEffective: MultiScaleSuggestion[];
  failClosedReasons: string[];
};

export function runPortfolioPlanner(input: PortfolioPlannerInput): PortfolioPlannerResult {
  const failClosedReasons: string[] = [];
  const accounts = Array.isArray(input.accounts) ? input.accounts : [];
  const campaigns = Array.isArray(input.campaigns) ? input.campaigns : [];
  const creatives = Array.isArray(input.creatives) ? input.creatives : [];

  const metrics = getPortfolioMetrics(campaigns);
  const accountResolution = resolveAccountControlState(
    campaigns.map((c) => ({ spend: Math.max(0, c.spend) })),
    metrics.roas,
  );
  const portfolioPolicy = accountResolution.portfolioPolicy;

  const allocationBase = allocateBudget(accounts, campaigns);
  let allocationFinal = allocationBase;
  if (portfolioPolicy.mode === "reduce_all") {
    allocationFinal = allocationBase.map((a) => ({
      ...a,
      budget: Math.round(Math.max(0, a.budget) * portfolioPolicy.factor),
    }));
    failClosedReasons.push("Portfolio ROAS under reduksjonsgrense — allokerte budsjetter redusert i plan.");
  }

  const activeCreatives = getActiveCreatives(creatives);
  const rotationOrder = rotateCreatives(activeCreatives);

  const creativeVariantsByCampaign = campaigns.map((c) => ({
    campaignId: c.id,
    variants: assignCreativeVariants({ id: c.id }, rotationOrder),
  }));

  const diversified = diversify(accounts, campaigns);

  const scalingSuggestions = scaleAcrossAccounts(accounts, campaigns);
  let scalingEffective: MultiScaleSuggestion[];

  if (accountResolution.spendStatus === "freeze_all") {
    scalingEffective = scalingSuggestions.map(() => null);
    failClosedReasons.push("Kontofryst (spend over tak) — ingen multi-account skalering.");
  } else if (portfolioPolicy.mode === "reduce_all") {
    scalingEffective = scalingSuggestions.map(() => null);
    failClosedReasons.push("Skalering avslått under portfolio-reduksjon.");
  } else if (portfolioPolicy.mode === "scale_allowed") {
    scalingEffective = scalingSuggestions;
  } else {
    const had = scalingSuggestions.some((x) => x != null);
    scalingEffective = scalingSuggestions.map(() => null);
    if (had) {
      failClosedReasons.push("Portfolio ROAS ikke over skaleringsgrense — vinner-skalert holdt tilbake.");
    }
  }

  return {
    metrics,
    portfolioPolicy,
    accountResolution,
    allocationBase,
    allocationFinal,
    rotationOrder,
    creativeVariantsByCampaign,
    diversified,
    scalingSuggestions,
    scalingEffective,
    failClosedReasons,
  };
}
