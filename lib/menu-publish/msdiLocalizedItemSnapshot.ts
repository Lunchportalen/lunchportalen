/**
 * MSDI localized item snapshot bridge — menu-publish only.
 * Uses SOT MSDI policy/mapping modules without wiring resolver hook into protected sync paths.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import type { EnvLike } from "@/lib/menu-profile/featureFlag";
import {
  mapMsdiLocalizedItemSnapshot,
  type MsdiLocalizedItemMappingResult,
  type VarmrettMenuProjection,
} from "@/lib/menu-generator/sotMsdiItemMapping";
import { resolveMsdiLocalizedMappingPolicy } from "@/lib/menu-generator/sotMsdiMappingPolicy";

export type ProviderMarketSnapshot = {
  countryCode: string;
  currency: string;
};

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

export function readMsdiLocalizedMappingEnv(env: EnvLike = process.env): EnvLike {
  return env;
}

export function isMsdiLocalizedMappingActiveForSync(providerId: string, env: EnvLike = process.env): boolean {
  return resolveMsdiLocalizedMappingPolicy(providerId, env).msdiMappingActiveForSync;
}

export async function fetchProviderMarketForMsdi(
  admin: SupabaseClient<any>,
  providerId: string,
): Promise<ProviderMarketSnapshot | null> {
  const normalized = safeTrim(providerId);
  if (!normalized) return null;

  const { data, error } = await admin
    .from("provider_settings")
    .select("default_country_code, default_currency")
    .eq("provider_id", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`provider_settings (msdi localized): ${error.message}`);
  }

  const countryCode = safeTrim((data as { default_country_code?: string } | null)?.default_country_code).toUpperCase();
  const currency = safeTrim((data as { default_currency?: string } | null)?.default_currency).toUpperCase();
  if (!countryCode || !currency) return null;

  return { countryCode, currency };
}

export function resolveMsdiLocalizedItemSnapshotForCategory(input: {
  categoryKey: string;
  categoryTitle: string;
  tier: PlanTier;
  market: ProviderMarketSnapshot;
  varmrettProjection?: VarmrettMenuProjection;
  staticCategoryItems?: unknown[] | null;
}): MsdiLocalizedItemMappingResult {
  return mapMsdiLocalizedItemSnapshot({
    categoryKey: input.categoryKey,
    categoryTitle: input.categoryTitle,
    tier: input.tier,
    countryCode: input.market.countryCode,
    currency: input.market.currency,
    varmrettProjection: input.varmrettProjection,
    staticCategoryItems: input.staticCategoryItems,
  });
}
