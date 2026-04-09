import type { GtmDeal } from "@/lib/crm/pipeline";

export type GtmDealAttribution = {
  dealId: string;
  source: string;
  value: number;
  timestamp: number;
};

/** Navnekonflikt unngått med `lib/revenue/attribution.ts` (URL-fasit). */
export function attributeDeal(deal: GtmDeal, source: string): GtmDealAttribution {
  return {
    dealId: deal.id,
    source: String(source ?? "").trim() || "unknown",
    value: Number.isFinite(deal.value) ? deal.value : 0,
    timestamp: Date.now(),
  };
}
