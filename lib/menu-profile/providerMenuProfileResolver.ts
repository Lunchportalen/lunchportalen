/**
 * ADR-019 G3 — Pure mapper from provider_settings fields to menu profile resolver.
 *
 * No DB, Supabase, or app imports. Not wired to publish/order/week until explicit cutover.
 */

import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import type { MarketCode, MenuProfileResolverResult } from "@/lib/menu-profile/types";
import { MARKET_CODES } from "@/lib/menu-profile/types";

export type ProviderSettingsMenuProfileInput = {
  providerId?: string;
  menuProfileId?: string | null;
  defaultCountryCode?: string | null;
  locale?: string | null;
  env?: Readonly<Record<string, string | undefined>>;
};

/** Maps ISO country code to registry market (legacy "UK" values normalize to GB). */
export function providerCountryCodeToMarket(countryCode: unknown): MarketCode | null {
  const code = String(countryCode ?? "").trim().toUpperCase();
  if (!code) return null;
  if (code === "UK") return "GB";
  return (MARKET_CODES as readonly string[]).includes(code) ? (code as MarketCode) : null;
}

export function resolveProviderMenuProfileFromSettings(
  input: ProviderSettingsMenuProfileInput,
): MenuProfileResolverResult {
  return resolveMenuProfileForProvider({
    providerId: input.providerId,
    menuProfileId: input.menuProfileId,
    market: providerCountryCodeToMarket(input.defaultCountryCode),
    locale: input.locale,
    env: input.env,
  });
}
