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
  GB: {
    market: "GB",
    defaultMenuProfileId: "uk_office_lunch",
    defaultCurrency: "GBP",
    defaultLocale: "en-GB",
  },
  IT: {
    market: "IT",
    defaultMenuProfileId: "italian_office_lunch",
    defaultCurrency: "EUR",
    defaultLocale: "it-IT",
  },
  US: {
    market: "US",
    defaultMenuProfileId: "us_office_lunch",
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    timezoneStrategy: "provider_required",
    defaultTimezoneForPilot: "America/New_York",
  },
  CA: {
    market: "CA",
    defaultMenuProfileId: "canadian_office_lunch",
    defaultCurrency: "CAD",
    defaultLocale: "en-CA",
    timezoneStrategy: "provider_required",
    defaultTimezoneForPilot: "America/Toronto",
  },
  NL: {
    market: "NL",
    defaultMenuProfileId: "dutch_office_lunch",
    defaultCurrency: "EUR",
    defaultLocale: "nl-NL",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Amsterdam",
  },
  BE: {
    market: "BE",
    defaultMenuProfileId: "belgian_dutch_office_lunch",
    defaultCurrency: "EUR",
    defaultLocale: "nl-BE",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Brussels",
  },
  AT: {
    market: "AT",
    defaultMenuProfileId: "austrian_office_lunch",
    defaultCurrency: "EUR",
    defaultLocale: "de-AT",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Vienna",
  },
  CH: {
    market: "CH",
    defaultMenuProfileId: "swiss_german_office_lunch",
    defaultCurrency: "CHF",
    defaultLocale: "de-CH",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Zurich",
  },
  IE: {
    market: "IE",
    defaultMenuProfileId: "irish_office_lunch",
    defaultCurrency: "EUR",
    defaultLocale: "en-IE",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Dublin",
  },
  PL: {
    market: "PL",
    defaultMenuProfileId: "polish_office_lunch",
    defaultCurrency: "PLN",
    defaultLocale: "pl-PL",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Warsaw",
  },
  RO: {
    market: "RO",
    defaultMenuProfileId: "romanian_office_lunch",
    defaultCurrency: "RON",
    defaultLocale: "ro-RO",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Bucharest",
  },
  CZ: {
    market: "CZ",
    defaultMenuProfileId: "czech_office_lunch",
    defaultCurrency: "CZK",
    defaultLocale: "cs-CZ",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Prague",
  },
  PT: {
    market: "PT",
    defaultMenuProfileId: "portuguese_office_lunch",
    defaultCurrency: "EUR",
    defaultLocale: "pt-PT",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Lisbon",
  },
  GR: {
    market: "GR",
    defaultMenuProfileId: "greek_office_lunch",
    defaultCurrency: "EUR",
    defaultLocale: "el-GR",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Athens",
  },
  LU: {
    market: "LU",
    defaultMenuProfileId: "luxembourg_office_lunch",
    defaultCurrency: "EUR",
    defaultLocale: "fr-LU",
    timezoneStrategy: "fixed",
    defaultTimezone: "Europe/Luxembourg",
  },
  AU: {
    market: "AU",
    defaultMenuProfileId: "australian_office_lunch",
    defaultCurrency: "AUD",
    defaultLocale: "en-AU",
    timezoneStrategy: "provider_required",
    defaultTimezoneForPilot: "Australia/Sydney",
  },
  SG: {
    market: "SG",
    defaultMenuProfileId: "singapore_office_lunch",
    defaultCurrency: "SGD",
    defaultLocale: "en-SG",
    timezoneStrategy: "fixed",
    defaultTimezone: "Asia/Singapore",
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
