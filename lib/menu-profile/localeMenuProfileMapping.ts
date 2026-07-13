/**
 * Phase 2 — Map provider operational intl locale → market + menu_profile_id.
 * Persistence only; runtime cutover remains behind LP_MENU_PROFILE_* flags.
 */

import { APP_LOCALES, intlLocaleForAppLocale, type AppLocale } from "@/lib/i18n/localeRegistry";
import { getMarketDefaults, MARKET_DEFAULTS } from "@/lib/menu-profile/marketDefaults";
import { isSupportedMenuProfile } from "@/lib/menu-profile/registry";
import type { MarketCode, MenuProfileId } from "@/lib/menu-profile/types";

export type ProviderLocaleMarketMapping = {
  intlLocale: string;
  market: MarketCode;
  defaultCountryCode: string;
  defaultCurrency: string;
  menuProfileId: MenuProfileId;
  usedFallback: boolean;
};

const FALLBACK_MARKET: MarketCode = "NO";

/** ISO country stored in provider_settings.default_country_code (market codes are ISO). */
export function marketToDefaultCountryCode(market: MarketCode): string {
  return market;
}

function findMarketByIntlLocale(intlLocale: string): MarketCode | null {
  for (const market of Object.keys(MARKET_DEFAULTS) as MarketCode[]) {
    if (MARKET_DEFAULTS[market].defaultLocale === intlLocale) {
      return market;
    }
  }
  return null;
}

export function resolveMarketMenuProfileFromProviderLocale(
  intlLocale: unknown,
): ProviderLocaleMarketMapping {
  const normalized = String(intlLocale ?? "").trim();
  const market = findMarketByIntlLocale(normalized);

  if (market) {
    const defaults = getMarketDefaults(market);
    return {
      intlLocale: defaults.defaultLocale,
      market,
      defaultCountryCode: marketToDefaultCountryCode(market),
      defaultCurrency: defaults.defaultCurrency,
      menuProfileId: defaults.defaultMenuProfileId,
      usedFallback: false,
    };
  }

  const fallback = getMarketDefaults(FALLBACK_MARKET);
  return {
    intlLocale: fallback.defaultLocale,
    market: FALLBACK_MARKET,
    defaultCountryCode: marketToDefaultCountryCode(FALLBACK_MARKET),
    defaultCurrency: fallback.defaultCurrency,
    menuProfileId: fallback.defaultMenuProfileId,
    usedFallback: true,
  };
}

export function resolveMenuProfileIdFromProviderLocale(intlLocale: unknown): MenuProfileId {
  return resolveMarketMenuProfileFromProviderLocale(intlLocale).menuProfileId;
}

export function resolveMenuProfileIdFromAppLocale(appLocale: AppLocale): MenuProfileId {
  return resolveMenuProfileIdFromProviderLocale(intlLocaleForAppLocale(appLocale));
}

/** All nine APP_LOCALES → persisted menu profile mapping (for tests and audits). */
export const APP_LOCALE_MENU_PROFILE_MAPPINGS = APP_LOCALES.map((appLocale) => ({
  appLocale,
  ...resolveMarketMenuProfileFromProviderLocale(intlLocaleForAppLocale(appLocale)),
}));

export function isValidPersistedMenuProfileId(profileId: unknown): profileId is MenuProfileId {
  return typeof profileId === "string" && isSupportedMenuProfile(profileId);
}
