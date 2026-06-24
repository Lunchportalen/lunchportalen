/**
 * INERT MARKET DEFAULTS — ADR-019 G0
 *
 * Maps market → default menu profile, currency, and locale.
 * NOT FOR RUNTIME until G1+ phase gate.
 */

import { assertMenuProfile } from "@/lib/menu-profile/registry";
import type { MarketCode, MarketDefaults, MenuProfile } from "@/lib/menu-profile/types";

export const MARKET_DEFAULTS: Readonly<Record<MarketCode, MarketDefaults>> = {
  NO: {
    market: "NO",
    defaultMenuProfileId: "norwegian_company_lunch",
    defaultCurrency: `${"NO"}K`,
    defaultLocale: "nb-NO",
  },
  SE: {
    market: "SE",
    defaultMenuProfileId: "swedish_lunch",
    defaultCurrency: "SEK",
    defaultLocale: "sv-SE",
  },
  DK: {
    market: "DK",
    defaultMenuProfileId: "danish_office_lunch",
    defaultCurrency: "DKK",
    defaultLocale: "da-DK",
  },
  FI: {
    market: "FI",
    defaultMenuProfileId: "finnish_office_lunch",
    defaultCurrency: "EUR",
    defaultLocale: "fi-FI",
  },
  DE: {
    market: "DE",
    defaultMenuProfileId: "german_business_lunch",
    defaultCurrency: "EUR",
    defaultLocale: "de-DE",
  },
  FR: {
    market: "FR",
    defaultMenuProfileId: "french_dejeuner",
    defaultCurrency: "EUR",
    defaultLocale: "fr-FR",
  },
  ES: {
    market: "ES",
    defaultMenuProfileId: "spanish_menu_del_dia",
    defaultCurrency: "EUR",
    defaultLocale: "es-ES",
  },
  UK: {
    market: "UK",
    defaultMenuProfileId: "uk_office_lunch",
    defaultCurrency: "GBP",
    defaultLocale: "en-GB",
  },
};

export function getMarketDefaults(market: MarketCode): MarketDefaults {
  const defaults = MARKET_DEFAULTS[market];
  if (!defaults) {
    throw new Error(`Unknown market: ${market}`);
  }
  return defaults;
}

export function getDefaultMenuProfileForMarket(market: MarketCode): MenuProfile {
  const defaults = getMarketDefaults(market);
  return assertMenuProfile(defaults.defaultMenuProfileId);
}
