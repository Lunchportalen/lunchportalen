// lib/providers/providerMenuPricePreviewDisplay.ts
// Client-safe mirror of optional pricePreview API payload (R4E-2 UI).

import type { PlanTier } from "@/lib/cms/menuDayContract";

export type ProviderMenuPricePreviewDisplaySource =
  | "provider_price_rules_market"
  | "fallback_tier_pricing"
  | "invalid/missing";

export type ProviderMenuPricePreviewDisplayAggregateSource =
  | "provider_price_rules_market"
  | "fallback_tier_pricing"
  | "mixed";

export type ProviderMenuPricePreviewDisplayTier = {
  amountExVat: number;
  priceIncVatNok: number;
  currency: string;
  vatRate: number;
  taxBasis: string | null;
  taxCategory: string | null;
  source: ProviderMenuPricePreviewDisplaySource;
  rowSource: string | null;
  differsFromProduction: boolean;
};

export type ProviderMenuPricePreviewDisplayPayload = {
  preview: true;
  resolverVersion: "r4d-preview-v1";
  marketCode: "NO";
  aggregateSource: ProviderMenuPricePreviewDisplayAggregateSource;
  tiers: Record<PlanTier, ProviderMenuPricePreviewDisplayTier>;
};

export function previewAggregateSourceLabelKey(
  aggregateSource: ProviderMenuPricePreviewDisplayAggregateSource,
): "sourceMarket" | "sourceFallback" | "sourceMixed" {
  if (aggregateSource === "provider_price_rules_market") return "sourceMarket";
  if (aggregateSource === "fallback_tier_pricing") return "sourceFallback";
  return "sourceMixed";
}

export function formatPreviewTaxBasisLabel(taxBasis: string | null): string | null {
  if (!taxBasis) return null;
  const normalized = taxBasis.trim().toLowerCase();
  if (normalized === "ex_tax") return "ex_tax";
  if (normalized === "inc_tax") return "inc_tax";
  return taxBasis;
}
