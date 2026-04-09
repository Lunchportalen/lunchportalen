import type { OmniscientState } from "@/lib/ai/omniscientContext";

export type RevenueOfferTag = "DISCOUNT_ENTRY_OFFER" | "BUNDLE_PRODUCTS" | "UPSELL_PREMIUM";

/**
 * Offer labels for audit / safe downstream mapping — not live coupons or price changes.
 */
export function generateOffers(state: OmniscientState): RevenueOfferTag[] {
  const offers: RevenueOfferTag[] = [];
  if (state.conversion < 0.02) offers.push("DISCOUNT_ENTRY_OFFER");
  if (state.avgOrderValue < 150) offers.push("BUNDLE_PRODUCTS");
  if (state.ltv > state.cac * 3) offers.push("UPSELL_PREMIUM");
  return offers;
}
