/**
 * Policy-validering per handlingstype — fail-closed.
 */

import type { ResolvedAutonomyPolicy } from "@/lib/autonomy/policy";
import type { AutonomousAction, AutonomousActionType } from "@/lib/autonomy/types";

export type ValidationContext = {
  dailySpend?: number;
  proposedPriceDeltaPct?: number;
  proposedProcurementCost?: number;
};

function category(t: AutonomousActionType): "ads" | "pricing" | "procurement" | "content" | "video" {
  if (t === "ads_adjust") return "ads";
  if (t === "pricing_adjust") return "pricing";
  if (t === "procurement_suggest") return "procurement";
  if (t === "content_generate") return "content";
  return "video";
}

export function validateAction(
  action: AutonomousAction,
  context: ValidationContext,
  policy: ResolvedAutonomyPolicy,
): boolean {
  if (!policy.enabled) return false;

  const cat = category(action.type);
  const spend = typeof context.dailySpend === "number" && Number.isFinite(context.dailySpend) ? context.dailySpend : 0;
  const priceDelta =
    typeof context.proposedPriceDeltaPct === "number" && Number.isFinite(context.proposedPriceDeltaPct)
      ? Math.abs(context.proposedPriceDeltaPct)
      : typeof action.payload?.priceDeltaPct === "number"
        ? Math.abs(action.payload.priceDeltaPct)
        : 0;
  const procCost =
    typeof context.proposedProcurementCost === "number" && Number.isFinite(context.proposedProcurementCost)
      ? context.proposedProcurementCost
      : typeof action.payload?.estProcurementCost === "number"
        ? action.payload.estProcurementCost
        : 0;
  const adSpend =
    typeof action.payload?.dailySpend === "number" && Number.isFinite(action.payload.dailySpend)
      ? action.payload.dailySpend
      : spend;

  if (cat === "ads") {
    if (!policy.allowAutoAds) return false;
    if (adSpend > policy.maxDailyAdSpend) return false;
    return true;
  }
  if (cat === "pricing") {
    if (!policy.allowAutoPricing) return false;
    if (priceDelta > policy.maxPriceChange) return false;
    return true;
  }
  if (cat === "procurement") {
    if (!policy.allowAutoProcurement) return false;
    if (procCost > policy.maxProcurementCost) return false;
    return true;
  }
  if (cat === "content" || cat === "video") {
    return policy.enabled;
  }
  return false;
}
