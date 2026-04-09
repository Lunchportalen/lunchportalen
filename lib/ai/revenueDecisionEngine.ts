import { generateVariant } from "@/lib/ai/generateVariant";
import type { SingularityActionWithScore } from "@/lib/ai/prioritizationEngine";
import type { AdvancedPricingSimulation } from "@/lib/ai/pricingSimulationEngine";
import type { RevenueOfferTag } from "@/lib/ai/offerEngine";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";

export type RevenueDecisionAction =
  | { type: "RUN_PRICING_EXPERIMENT"; data: AdvancedPricingSimulation }
  | { type: "CREATE_OFFER"; data: RevenueOfferTag | string };

/**
 * Planned revenue actions for audit. RUN_PRICING_EXPERIMENT is blocked by {@link validateRevenueAction} before execution.
 */
export function decideRevenueActions(
  simulations: AdvancedPricingSimulation[],
  offers: RevenueOfferTag[],
): RevenueDecisionAction[] {
  const actions: RevenueDecisionAction[] = [];
  if (simulations.length > 0) {
    actions.push({ type: "RUN_PRICING_EXPERIMENT", data: simulations[0]! });
  }
  for (const o of offers) {
    actions.push({ type: "CREATE_OFFER", data: o });
  }
  return actions;
}

/**
 * Maps filtered CREATE_OFFER actions to allowlisted singularity steps (draft / optimize cron / home experiment only).
 * Dedupes by singularity type in first-seen order; max length enforced by caller (e.g. slice(0, 2)).
 */
export function toSingularityActionsFromRevenueOffers(actions: RevenueDecisionAction[]): SingularityActionWithScore[] {
  const mapped: SingularityActionWithScore[] = [];
  for (const a of actions) {
    if (a.type !== "CREATE_OFFER") continue;
    const label = String(a.data ?? "").trim() as RevenueOfferTag;
    if (label === "DISCOUNT_ENTRY_OFFER") {
      mapped.push({ type: "experiment", score: 0 });
    } else if (label === "BUNDLE_PRODUCTS") {
      mapped.push({ type: "variant", data: generateVariant(buildMarketingHomeBody()), score: 0 });
    } else if (label === "UPSELL_PREMIUM") {
      mapped.push({ type: "optimize", score: 0 });
    }
  }
  const seen = new Set<string>();
  const deduped: SingularityActionWithScore[] = [];
  for (const m of mapped) {
    if (seen.has(m.type)) continue;
    seen.add(m.type);
    deduped.push(m);
  }
  return deduped;
}
