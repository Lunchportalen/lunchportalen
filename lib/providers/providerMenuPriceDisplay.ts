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

const DEFAULT_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};

export function formatPriceAmount(
  amount: number,
  locale = "nb-NO",
  options: Intl.NumberFormatOptions = DEFAULT_NUMBER_FORMAT,
): string {
  return amount.toLocaleString(locale, options);
}

export function formatPriceExVatLabel(
  priceExVatNok: number,
  suffix = "kr eks. mva",
  locale = "nb-NO",
): string {
  return `${formatPriceAmount(priceExVatNok, locale)} ${suffix}`;
}

export function formatPriceIncVatLabel(
  priceIncVatNok: number,
  suffix = "kr inkl. mva",
  locale = "nb-NO",
): string {
  return `${formatPriceAmount(priceIncVatNok, locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${suffix}`;
}

export function formatProviderMenuPricePair(
  price: ProviderMenuPriceView,
  exSuffix = "kr eks. mva",
  incSuffix = "kr inkl. mva",
  locale = "nb-NO",
): string {
  return `${formatPriceExVatLabel(price.priceExVatNok, exSuffix, locale)} · ${formatPriceIncVatLabel(price.priceIncVatNok, incSuffix, locale)}`;
}
