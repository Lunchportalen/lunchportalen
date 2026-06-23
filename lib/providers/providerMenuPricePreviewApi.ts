// lib/providers/providerMenuPricePreviewApi.ts
// R4E-1: slim API payload for optional provider menu price preview diagnostics.

import "server-only";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { PLAN_TIERS } from "@/lib/cms/menuDayContract";
import type { ProviderMenuPriceDisplay } from "@/lib/providers/providerMenuPriceConfig";
import type {
  ProviderMenuPricePreviewAggregateSource,
  ProviderMenuPricePreviewResult,
  ProviderMenuPricePreviewSource,
} from "@/lib/providers/providerMenuPricePreview";

export type ProviderMenuPricePreviewApiTier = {
  amountExVat: number;
  priceIncVatNok: number;
  currency: string;
  vatRate: number;
  taxBasis: string | null;
  taxCategory: string | null;
  source: ProviderMenuPricePreviewSource;
  rowSource: string | null;
  differsFromProduction: boolean;
};

export type ProviderMenuPricePreviewApiPayload = {
  preview: true;
  resolverVersion: "r4d-preview-v1";
  marketCode: "NO";
  aggregateSource: ProviderMenuPricePreviewAggregateSource;
  tiers: Record<PlanTier, ProviderMenuPricePreviewApiTier>;
};

/** Compare monetary values at øre precision to avoid float noise. */
function moneyEqual(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

function tierDiffersFromProduction(
  previewAmountExVat: number,
  previewVatRate: number,
  previewPriceIncVatNok: number,
  production: ProviderMenuPriceDisplay,
): boolean {
  return (
    !moneyEqual(previewAmountExVat, production.priceExVatNok) ||
    !moneyEqual(previewVatRate, production.vatRate) ||
    !moneyEqual(previewPriceIncVatNok, production.priceIncVatNok)
  );
}

export function toProviderMenuPricePreviewApiPayload(
  preview: ProviderMenuPricePreviewResult,
  prices: Record<PlanTier, ProviderMenuPriceDisplay>,
): ProviderMenuPricePreviewApiPayload {
  const tiers = {} as Record<PlanTier, ProviderMenuPricePreviewApiTier>;

  for (const tier of PLAN_TIERS) {
    const pt = preview.tiers[tier];
    const prod = prices[tier];
    tiers[tier] = {
      amountExVat: pt.amountExVat,
      priceIncVatNok: pt.priceIncVatNok,
      currency: pt.currency,
      vatRate: pt.vatRate,
      taxBasis: pt.taxBasis,
      taxCategory: pt.taxCategory,
      source: pt.source,
      rowSource: pt.rowSource,
      differsFromProduction: tierDiffersFromProduction(
        pt.amountExVat,
        pt.vatRate,
        pt.priceIncVatNok,
        prod,
      ),
    };
  }

  return {
    preview: true,
    resolverVersion: "r4d-preview-v1",
    marketCode: "NO",
    aggregateSource: preview.diagnostics.aggregateSource,
    tiers,
  };
}
