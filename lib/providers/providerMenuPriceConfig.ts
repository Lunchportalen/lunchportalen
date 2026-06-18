// lib/providers/providerMenuPriceConfig.ts
// Provider-scoped menu package prices: provider_price_rules when present, else tier fallback.

import "server-only";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { PLAN_TIERS } from "@/lib/cms/menuDayContract";
import { TIER_PRICE_CENTS, VAT_RATE } from "@/lib/menu-publish/tierPricing";
import type { ProviderMenuPriceView } from "@/lib/providers/providerMenuPriceDisplay";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProviderMenuPriceSource = "provider_price_rules" | "fallback";

export type ProviderMenuPriceDisplay = ProviderMenuPriceView;

export { formatPriceExVatLabel, formatPriceIncVatLabel, formatProviderMenuPricePair } from "@/lib/providers/providerMenuPriceDisplay";

export function centsToNok(cents: number): number {
  return Math.round(cents) / 100;
}

export function computePriceIncVatNok(priceExVatNok: number, vatRate: number): number {
  return Math.round(priceExVatNok * (1 + vatRate) * 100) / 100;
}

export function fallbackProviderMenuPrices(): Record<PlanTier, ProviderMenuPriceDisplay> {
  const out = {} as Record<PlanTier, ProviderMenuPriceDisplay>;
  for (const tier of PLAN_TIERS) {
    const priceExVatNok = centsToNok(TIER_PRICE_CENTS[tier]);
    out[tier] = {
      tier,
      priceExVatNok,
      vatRate: VAT_RATE,
      priceIncVatNok: computePriceIncVatNok(priceExVatNok, VAT_RATE),
      source: "fallback",
    };
  }
  return out;
}

/**
 * Loads tier-level prices from provider_price_rules when migration + rows exist.
 * Falls back to tierPricing.ts seed values (90/130/170 eks. mva @ 15 %).
 */
export async function loadProviderMenuPrices(providerId: string): Promise<Record<PlanTier, ProviderMenuPriceDisplay>> {
  const pid = String(providerId ?? "").trim();
  const fallback = fallbackProviderMenuPrices();
  if (!pid) return fallback;

  try {
    const admin = supabaseAdmin();
    const { data, error } = await (admin as any)
      .from("provider_price_rules")
      .select("tier, amount_ex_vat, vat_rate")
      .eq("provider_id", pid)
      .eq("is_active", true)
      .is("customer_id", null)
      .is("agreement_id", null)
      .not("tier", "is", null);

    if (error || !Array.isArray(data) || data.length === 0) {
      return fallback;
    }

    const resolved = { ...fallback };
    let hit = 0;

    for (const row of data) {
      const tier = String((row as { tier?: string }).tier ?? "")
        .trim()
        .toUpperCase() as PlanTier;
      if (!PLAN_TIERS.includes(tier)) continue;
      const amount = Number((row as { amount_ex_vat?: number }).amount_ex_vat);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const vatRaw = (row as { vat_rate?: number | null }).vat_rate;
      const vatRate = vatRaw != null && Number.isFinite(Number(vatRaw)) ? Number(vatRaw) : VAT_RATE;
      resolved[tier] = {
        tier,
        priceExVatNok: amount,
        vatRate,
        priceIncVatNok: computePriceIncVatNok(amount, vatRate),
        source: "provider_price_rules",
      };
      hit += 1;
    }

    return hit > 0 ? resolved : fallback;
  } catch {
    return fallback;
  }
}
