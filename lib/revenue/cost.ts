/**
 * Sann profit når annonsekostnad er kjent — ellers fail-closed (ikke gjett).
 */

import { ATTRIBUTION_CONFIDENCE_THRESHOLD, scoreAttribution } from "@/lib/revenue/confidence";
import type { RevenueEvent } from "@/lib/revenue/unified";

export type TrueProfitOk = { ok: true; profit: number };
export type TrueProfitBlocked = { ok: false; reason: "missing_spend" | "invalid_amount" | "weak_attribution" };

export function calculateTrueProfit(
  event: RevenueEvent,
  campaign: { spend?: number } | null | undefined,
): TrueProfitOk | TrueProfitBlocked {
  if (!(typeof event.amount === "number" && Number.isFinite(event.amount))) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (scoreAttribution(event) <= ATTRIBUTION_CONFIDENCE_THRESHOLD) {
    return { ok: false, reason: "weak_attribution" };
  }
  const spend = campaign?.spend;
  if (typeof spend !== "number" || !Number.isFinite(spend) || spend < 0) {
    return { ok: false, reason: "missing_spend" };
  }
  return { ok: true, profit: event.amount - spend };
}
