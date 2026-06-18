// lib/providers/providerMenuPriceDisplay.ts
// Client-safe price labels for provider menu builder (no server-only).

import type { PlanTier } from "@/lib/cms/menuDayContract";

export type ProviderMenuPriceView = {
  tier: PlanTier;
  priceExVatNok: number;
  vatRate: number;
  priceIncVatNok: number;
  source: "provider_price_rules" | "fallback";
};

export function formatPriceExVatLabel(priceExVatNok: number): string {
  return `${priceExVatNok.toLocaleString("nb-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr eks. mva`;
}

export function formatPriceIncVatLabel(priceIncVatNok: number): string {
  return `${priceIncVatNok.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr inkl. mva`;
}

export function formatProviderMenuPricePair(price: ProviderMenuPriceView): string {
  return `${formatPriceExVatLabel(price.priceExVatNok)} · ${formatPriceIncVatLabel(price.priceIncVatNok)}`;
}
