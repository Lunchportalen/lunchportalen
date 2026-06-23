// lib/providers/providerMenuPricePreview.ts
// R4D: market-ready provider menu price preview — test/diagnostics only; not wired to runtime.

import "server-only";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { PLAN_TIERS } from "@/lib/cms/menuDayContract";
import { MARKET_COMMERCIAL_CONFIGS } from "@/lib/commercial/marketConfigs";
import {
  computePriceIncVatNok,
  fallbackProviderMenuPrices,
} from "@/lib/providers/providerMenuPriceConfig";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProviderMenuPricePreviewSource =
  | "provider_price_rules_market"
  | "fallback_tier_pricing"
  | "invalid/missing";

export type ProviderMenuPricePreviewTier = {
  tier: PlanTier;
  amountExVat: number;
  priceIncVatNok: number;
  currency: string;
  vatRate: number;
  taxBasis: string | null;
  taxCategory: string | null;
  marketCode: string;
  source: ProviderMenuPricePreviewSource;
  validFrom: string | null;
  validTo: string | null;
  rowSource: string | null;
};

export type ProviderMenuPricePreviewAggregateSource =
  | "provider_price_rules_market"
  | "fallback_tier_pricing"
  | "mixed";

export type ProviderMenuPricePreviewDiagnostics = {
  preview: true;
  resolverVersion: "r4d-preview-v1";
  providerId: string;
  marketCode: "NO";
  aggregateSource: ProviderMenuPricePreviewAggregateSource;
  dbRowCount: number;
  tiersFromMarket: number;
  tiersFromFallback: number;
  skippedInvalidRows: number;
  queryError?: string;
};

export type ProviderMenuPricePreviewResult = {
  tiers: Record<PlanTier, ProviderMenuPricePreviewTier>;
  diagnostics: ProviderMenuPricePreviewDiagnostics;
};

export type ProviderMenuPricePreviewOptions = {
  marketCode?: "NO";
};

type PriceRuleRow = {
  tier?: string | null;
  amount_ex_vat?: number | null;
  vat_rate?: number | null;
  currency?: string | null;
  tax_basis?: string | null;
  tax_category?: string | null;
  source?: string | null;
  market_code?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
};

const PREVIEW_MARKET_CODE = "NO" as const;
const NO_DEFAULT_CURRENCY = MARKET_COMMERCIAL_CONFIGS.NO.defaultCurrency;

function tierFromFallback(
  tier: PlanTier,
  marketCode: "NO",
): ProviderMenuPricePreviewTier {
  const fb = fallbackProviderMenuPrices()[tier];
  return {
    tier,
    amountExVat: fb.priceExVatNok,
    priceIncVatNok: fb.priceIncVatNok,
    currency: NO_DEFAULT_CURRENCY,
    vatRate: fb.vatRate,
    taxBasis: null,
    taxCategory: null,
    marketCode,
    source: "fallback_tier_pricing",
    validFrom: null,
    validTo: null,
    rowSource: null,
  };
}

function aggregateSource(
  tiersFromMarket: number,
  tiersFromFallback: number,
): ProviderMenuPricePreviewAggregateSource {
  if (tiersFromMarket > 0 && tiersFromFallback === 0) return "provider_price_rules_market";
  if (tiersFromMarket === 0) return "fallback_tier_pricing";
  return "mixed";
}

function buildPreviewResult(
  providerId: string,
  tiers: Record<PlanTier, ProviderMenuPricePreviewTier>,
  partial: {
    dbRowCount: number;
    skippedInvalidRows: number;
    queryError?: string;
    aggregateSource?: ProviderMenuPricePreviewAggregateSource;
  },
): ProviderMenuPricePreviewResult {
  const tiersFromMarket = PLAN_TIERS.filter(
    (t) => tiers[t].source === "provider_price_rules_market",
  ).length;
  const tiersFromFallback = PLAN_TIERS.filter(
    (t) => tiers[t].source === "fallback_tier_pricing",
  ).length;

  return {
    tiers,
    diagnostics: {
      preview: true,
      resolverVersion: "r4d-preview-v1",
      providerId,
      marketCode: PREVIEW_MARKET_CODE,
      aggregateSource:
        partial.aggregateSource ??
        aggregateSource(tiersFromMarket, tiersFromFallback),
      dbRowCount: partial.dbRowCount,
      tiersFromMarket,
      tiersFromFallback,
      skippedInvalidRows: partial.skippedInvalidRows,
      ...(partial.queryError ? { queryError: partial.queryError } : {}),
    },
  };
}

function fallbackPreviewResult(
  providerId: string,
  extra: Partial<Pick<ProviderMenuPricePreviewDiagnostics, "queryError" | "dbRowCount" | "skippedInvalidRows">> = {},
): ProviderMenuPricePreviewResult {
  const tiers = {} as Record<PlanTier, ProviderMenuPricePreviewTier>;
  for (const tier of PLAN_TIERS) {
    tiers[tier] = tierFromFallback(tier, PREVIEW_MARKET_CODE);
  }
  return buildPreviewResult(providerId, tiers, {
    dbRowCount: extra.dbRowCount ?? 0,
    skippedInvalidRows: extra.skippedInvalidRows ?? 0,
    aggregateSource: "fallback_tier_pricing",
    ...(extra.queryError ? { queryError: extra.queryError } : {}),
  });
}

/**
 * R4D preview resolver: reads NO market tier-default rows with full commercial metadata.
 * Not imported by app/runtime — diagnostics and tests only until R4E cutover behind flag.
 */
export async function loadProviderMenuPricesPreview(
  providerId: string,
  _options?: ProviderMenuPricePreviewOptions,
): Promise<ProviderMenuPricePreviewResult> {
  const pid = String(providerId ?? "").trim();
  const marketCode = PREVIEW_MARKET_CODE;

  if (!pid) {
    return fallbackPreviewResult("");
  }

  const baseTiers = {} as Record<PlanTier, ProviderMenuPricePreviewTier>;
  for (const tier of PLAN_TIERS) {
    baseTiers[tier] = tierFromFallback(tier, marketCode);
  }

  try {
    const admin = supabaseAdmin();
    const { data, error } = (await (admin as any)
      .from("provider_price_rules")
      .select(
        "tier, amount_ex_vat, vat_rate, currency, tax_basis, tax_category, source, market_code, valid_from, valid_to",
      )
      .eq("provider_id", pid)
      .eq("market_code", marketCode)
      .eq("is_active", true)
      .is("customer_id", null)
      .is("agreement_id", null)
      .is("menu_category_key", null)
      .is("menu_item_id", null)
      .not("tier", "is", null)) as {
      data: PriceRuleRow[] | null;
      error: { message?: string } | null;
    };

    if (error) {
      return fallbackPreviewResult(pid, {
        queryError: String(error.message ?? "provider_price_rules query failed"),
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return fallbackPreviewResult(pid, { dbRowCount: 0 });
    }

    const resolved = { ...baseTiers };
    let skippedInvalidRows = 0;
    let tiersFromMarket = 0;

    for (const row of data) {
      const tier = String(row.tier ?? "")
        .trim()
        .toUpperCase() as PlanTier;
      if (!PLAN_TIERS.includes(tier)) {
        skippedInvalidRows += 1;
        continue;
      }
      const amount = Number(row.amount_ex_vat);
      if (!Number.isFinite(amount) || amount <= 0) {
        skippedInvalidRows += 1;
        continue;
      }
      const vatRaw = row.vat_rate;
      const vatRate =
        vatRaw != null && Number.isFinite(Number(vatRaw))
          ? Number(vatRaw)
          : fallbackProviderMenuPrices()[tier].vatRate;

      resolved[tier] = {
        tier,
        amountExVat: amount,
        priceIncVatNok: computePriceIncVatNok(amount, vatRate),
        currency: String(row.currency ?? NO_DEFAULT_CURRENCY).trim() || NO_DEFAULT_CURRENCY,
        vatRate,
        taxBasis: row.tax_basis != null ? String(row.tax_basis) : null,
        taxCategory: row.tax_category != null ? String(row.tax_category) : null,
        marketCode: String(row.market_code ?? marketCode).trim() || marketCode,
        source: "provider_price_rules_market",
        validFrom: row.valid_from != null ? String(row.valid_from) : null,
        validTo: row.valid_to != null ? String(row.valid_to) : null,
        rowSource: row.source != null ? String(row.source) : null,
      };
      tiersFromMarket += 1;
    }

    if (tiersFromMarket === 0) {
      return fallbackPreviewResult(pid, {
        dbRowCount: data.length,
        skippedInvalidRows,
      });
    }

    return buildPreviewResult(pid, resolved, {
      dbRowCount: data.length,
      skippedInvalidRows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "provider_price_rules preview query failed";
    return fallbackPreviewResult(pid, { queryError: message });
  }
}
