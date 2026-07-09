/**
 * Localized generator SOT — pure MSDI item snapshot mapping from generated menuDay content.
 * No DB writes, no order write-path, no billing. Fail-closed when market/currency/content unsafe.
 */

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { filterLunchCategoryItemsRawForPlanTier } from "@/lib/cms/lunchCategory";
import { resolveEconomyConfigForCountry } from "@/lib/menu-generator/countryEconomyDefaults";
import { TIER_PRICE_CENTS } from "@/lib/menu-publish/tierPricing";
import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";
import type { PackageKey } from "@/lib/menu-profile/types";

export const LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE = "localized_generated_content" as const;

export type VarmrettMenuProjection = {
  mealTitle?: string | null;
  meal?: {
    title?: string | null;
    description?: string | null;
    allergens?: string[] | null;
  } | null;
} | null;

export type MsdiLocalizedItemMappingInput = {
  categoryKey: string;
  categoryTitle: string;
  tier: PlanTier;
  countryCode: string;
  currency: string;
  varmrettProjection?: VarmrettMenuProjection;
  staticCategoryItems?: unknown[] | null;
};

export type MsdiLocalizedItemMappingSuccess = {
  ok: true;
  productNameSnapshot: string;
  offeredPriceCentsExVat: number;
  vatRateSnapshot: number;
  currency: string;
  snapshotMode: typeof LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE;
};

export type MsdiLocalizedItemMappingFailure = {
  ok: false;
  blocker: string;
};

export type MsdiLocalizedItemMappingResult = MsdiLocalizedItemMappingSuccess | MsdiLocalizedItemMappingFailure;

const TIER_TO_PACKAGE: Record<PlanTier, PackageKey> = {
  BASIS: "basis",
  LUXUS: "luxus",
  ENTERPRISE: "enterprise",
};

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function formatStaticCategorySnapshot(title: string, items: unknown): string {
  const parts: string[] = [title.trim()].filter(Boolean);
  if (!Array.isArray(items)) return parts.join(" · ");
  for (const raw of items) {
    const it = asRecord(raw);
    if (!it) continue;
    const slug = asRecord(it.slug);
    const slugCur = slug ? safeTrim(slug.current) : "";
    const t = safeTrim(it.title) || slugCur;
    if (t) parts.push(t);
    const d = safeTrim(it.description);
    if (d) parts.push(d);
    const allergens = it.allergens;
    if (Array.isArray(allergens) && allergens.length) {
      parts.push(`Allergener: ${allergens.map((a) => safeTrim(a)).filter(Boolean).join(", ")}`);
    }
  }
  return parts.filter(Boolean).join(" · ");
}

function formatVarmrettSnapshot(projection: VarmrettMenuProjection): string {
  const parts: string[] = [];
  const mealTitle = projection?.mealTitle ? safeTrim(projection.mealTitle) : "";
  if (mealTitle) parts.push(mealTitle);
  const meal = projection?.meal;
  if (meal) {
    const t = safeTrim(meal.title);
    if (t) parts.push(t);
    const d = safeTrim(meal.description);
    if (d) parts.push(d);
    const allergens = meal.allergens;
    if (Array.isArray(allergens) && allergens.length) {
      parts.push(`Allergener: ${allergens.map((a) => safeTrim(a)).filter(Boolean).join(", ")}`);
    }
  }
  return parts.filter(Boolean).join(" · ");
}

function resolveMarketPriceCents(
  countryCode: string,
  currency: string,
  tier: PlanTier,
): { ok: true; cents: number; vatRate: number; currency: string } | { ok: false; blocker: string } {
  const economy = resolveEconomyConfigForCountry(countryCode);
  const normalizedCurrency = safeTrim(currency).toUpperCase();
  const economyCurrency = safeTrim(economy.currency).toUpperCase();

  if (!normalizedCurrency || !economyCurrency) {
    return { ok: false, blocker: "missing_currency" };
  }
  if (normalizedCurrency !== economyCurrency) {
    return { ok: false, blocker: "currency_market_mismatch" };
  }

  const packageKey = TIER_TO_PACKAGE[tier];
  const pkg = economy.packagePriceRules[packageKey];
  if (!pkg || !Number.isFinite(pkg.exVat) || pkg.exVat <= 0) {
    return { ok: false, blocker: "missing_package_price" };
  }

  const cents = Math.round(pkg.exVat * 100);
  if (!Number.isFinite(cents) || cents <= 0) {
    return { ok: false, blocker: "invalid_price_cents" };
  }

  // Fail-closed: non-domestic markets must not receive legacy global tier-product øre snapshots.
  const domesticCurrency = getMarketDefaults("NO").defaultCurrency;
  const legacyCents = TIER_PRICE_CENTS[tier];
  if (economyCurrency !== domesticCurrency && cents === legacyCents) {
    return { ok: false, blocker: "legacy_tier_price_leakage" };
  }

  return { ok: true, cents, vatRate: economy.vatRate, currency: economyCurrency };
}

export function mapMsdiLocalizedItemSnapshot(input: MsdiLocalizedItemMappingInput): MsdiLocalizedItemMappingResult {
  const categoryKey = safeTrim(input.categoryKey).toLowerCase();
  const countryCode = safeTrim(input.countryCode).toUpperCase();
  const currency = safeTrim(input.currency).toUpperCase();

  if (!countryCode) {
    return { ok: false, blocker: "missing_country_code" };
  }

  const price = resolveMarketPriceCents(countryCode, currency, input.tier);
  if (price.ok === false) {
    return { ok: false, blocker: price.blocker };
  }

  let productNameSnapshot: string;
  if (categoryKey === "varmrett") {
    const formatted = formatVarmrettSnapshot(input.varmrettProjection ?? null);
    if (!formatted || formatted === "Varmrett") {
      return { ok: false, blocker: "incomplete_varmrett_generated_content" };
    }
    productNameSnapshot = formatted;
  } else {
    const title = safeTrim(input.categoryTitle) || categoryKey;
    productNameSnapshot = formatStaticCategorySnapshot(
      title,
      filterLunchCategoryItemsRawForPlanTier(input.staticCategoryItems ?? [], input.tier),
    );
    if (!productNameSnapshot) {
      return { ok: false, blocker: "incomplete_static_category_content" };
    }
  }

  return {
    ok: true,
    productNameSnapshot,
    offeredPriceCentsExVat: price.cents,
    vatRateSnapshot: price.vatRate,
    currency: price.currency,
    snapshotMode: LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE,
  };
}

export function buildMsdiLocalizedMappingDryRunPreview(input: {
  providerId: string;
  countryCode: string;
  currency: string;
  tier: PlanTier;
  varmrettProjection?: VarmrettMenuProjection;
}) {
  const sample = mapMsdiLocalizedItemSnapshot({
    categoryKey: "varmrett",
    categoryTitle: "Varmrett",
    tier: input.tier,
    countryCode: input.countryCode,
    currency: input.currency,
    varmrettProjection: input.varmrettProjection,
    staticCategoryItems: [],
  });

  return {
    providerId: input.providerId,
    snapshotMode: LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE,
    countryCode: input.countryCode,
    currency: input.currency,
    tier: input.tier,
    sampleVarmrett: sample.ok === true
      ? {
          productNameSnapshot: sample.productNameSnapshot,
          offeredPriceCentsExVat: sample.offeredPriceCentsExVat,
          vatRateSnapshot: sample.vatRateSnapshot,
          currency: sample.currency,
        }
      : { blocker: sample.blocker },
  };
}
