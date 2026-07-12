/**
 * Phase D rich-market expansion targets.
 *
 * Source-control only. These targets are dormant until a separate future GO
 * explicitly authorizes dryRun/apply work for a single provider.
 */

import type { CurrencyCode, MarketCode, MenuProfileId } from "@/lib/menu-profile/types";

export type PhaseDTargetStatus = "SOURCE_ONLY";
export type PhaseDTimezoneStrategy = "fixed" | "provider_required";

export type PhaseDLocaleTarget = {
  providerName: string;
  slug: string;
  locale: string;
  menuProfileId: MenuProfileId;
  countryCode: MarketCode;
  currency: CurrencyCode;
  timezoneStrategy: PhaseDTimezoneStrategy;
  timezone?: string;
  defaultTimezoneForPilot?: string;
  rolloutOrder: number;
  status: PhaseDTargetStatus;
  notes: string[];
  applyEnabled: false;
  publishEnabled: false;
  customerVisible: false;
  rolloutAutomationEnabled: false;
};

const SOURCE_ONLY_FLAGS = {
  status: "SOURCE_ONLY",
  applyEnabled: false,
  publishEnabled: false,
  customerVisible: false,
  rolloutAutomationEnabled: false,
} as const;

export const PHASE_D_PROVIDER_REQUIRED_TIMEZONE_MARKETS = ["US", "CA"] as const;

export const PHASE_D_RICH_MARKET_TARGETS: readonly PhaseDLocaleTarget[] = [
  {
    providerName: "US Lunch Pilot",
    slug: "us-lunch-pilot",
    locale: "en-US",
    menuProfileId: "us_office_lunch",
    countryCode: "US",
    currency: "USD",
    timezoneStrategy: "provider_required",
    defaultTimezoneForPilot: "America/New_York",
    rolloutOrder: 1,
    notes: ["State/local sales tax review required.", "Provider timezone must be explicit before apply."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Canadian Lunch Pilot",
    slug: "canadian-lunch-pilot",
    locale: "en-CA",
    menuProfileId: "canadian_office_lunch",
    countryCode: "CA",
    currency: "CAD",
    timezoneStrategy: "provider_required",
    defaultTimezoneForPilot: "America/Toronto",
    rolloutOrder: 2,
    notes: ["Province tax/timezone review required.", "fr-CA is not included in this batch."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Dutch Lunch Pilot",
    slug: "dutch-lunch-pilot",
    locale: "nl-NL",
    menuProfileId: "dutch_office_lunch",
    countryCode: "NL",
    currency: "EUR",
    timezoneStrategy: "fixed",
    timezone: "Europe/Amsterdam",
    rolloutOrder: 3,
    notes: ["EU VAT/compliance review required before live provider apply."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Belgian Dutch Lunch Pilot",
    slug: "belgian-dutch-lunch-pilot",
    locale: "nl-BE",
    menuProfileId: "belgian_dutch_office_lunch",
    countryCode: "BE",
    currency: "EUR",
    timezoneStrategy: "fixed",
    timezone: "Europe/Brussels",
    rolloutOrder: 4,
    notes: ["Belgium requires dual-locale handling with fr-BE.", "EU VAT/compliance review required."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Belgian French Lunch Pilot",
    slug: "belgian-french-lunch-pilot",
    locale: "fr-BE",
    menuProfileId: "belgian_french_office_lunch",
    countryCode: "BE",
    currency: "EUR",
    timezoneStrategy: "fixed",
    timezone: "Europe/Brussels",
    rolloutOrder: 5,
    notes: ["Belgium requires dual-locale handling with nl-BE.", "EU VAT/compliance review required."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Austrian Lunch Pilot",
    slug: "austrian-lunch-pilot",
    locale: "de-AT",
    menuProfileId: "austrian_office_lunch",
    countryCode: "AT",
    currency: "EUR",
    timezoneStrategy: "fixed",
    timezone: "Europe/Vienna",
    rolloutOrder: 6,
    notes: ["EU VAT/compliance review required before live provider apply."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Swiss German Lunch Pilot",
    slug: "swiss-german-lunch-pilot",
    locale: "de-CH",
    menuProfileId: "swiss_german_office_lunch",
    countryCode: "CH",
    currency: "CHF",
    timezoneStrategy: "fixed",
    timezone: "Europe/Zurich",
    rolloutOrder: 7,
    notes: ["CHF market.", "Coordinate with fr-CH for multilingual Swiss rollout."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Swiss French Lunch Pilot",
    slug: "swiss-french-lunch-pilot",
    locale: "fr-CH",
    menuProfileId: "swiss_french_office_lunch",
    countryCode: "CH",
    currency: "CHF",
    timezoneStrategy: "fixed",
    timezone: "Europe/Zurich",
    rolloutOrder: 8,
    notes: ["CHF market.", "Coordinate with de-CH for multilingual Swiss rollout."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Irish Lunch Pilot",
    slug: "irish-lunch-pilot",
    locale: "en-IE",
    menuProfileId: "irish_office_lunch",
    countryCode: "IE",
    currency: "EUR",
    timezoneStrategy: "fixed",
    timezone: "Europe/Dublin",
    rolloutOrder: 9,
    notes: ["EU VAT/compliance review required before live provider apply."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Polish Lunch Pilot",
    slug: "polish-lunch-pilot",
    locale: "pl-PL",
    menuProfileId: "polish_office_lunch",
    countryCode: "PL",
    currency: "PLN",
    timezoneStrategy: "fixed",
    timezone: "Europe/Warsaw",
    rolloutOrder: 10,
    notes: ["EU VAT/compliance review required before live provider apply."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Romanian Lunch Pilot",
    slug: "romanian-lunch-pilot",
    locale: "ro-RO",
    menuProfileId: "romanian_office_lunch",
    countryCode: "RO",
    currency: "RON",
    timezoneStrategy: "fixed",
    timezone: "Europe/Bucharest",
    rolloutOrder: 11,
    notes: ["EU VAT/compliance review required before live provider apply."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Czech Lunch Pilot",
    slug: "czech-lunch-pilot",
    locale: "cs-CZ",
    menuProfileId: "czech_office_lunch",
    countryCode: "CZ",
    currency: "CZK",
    timezoneStrategy: "fixed",
    timezone: "Europe/Prague",
    rolloutOrder: 12,
    notes: ["EU VAT/compliance review required before live provider apply."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Portuguese Lunch Pilot",
    slug: "portuguese-lunch-pilot",
    locale: "pt-PT",
    menuProfileId: "portuguese_office_lunch",
    countryCode: "PT",
    currency: "EUR",
    timezoneStrategy: "fixed",
    timezone: "Europe/Lisbon",
    rolloutOrder: 13,
    notes: ["EU VAT/compliance review required before live provider apply."],
    ...SOURCE_ONLY_FLAGS,
  },
  {
    providerName: "Greek Lunch Pilot",
    slug: "greek-lunch-pilot",
    locale: "el-GR",
    menuProfileId: "greek_office_lunch",
    countryCode: "GR",
    currency: "EUR",
    timezoneStrategy: "fixed",
    timezone: "Europe/Athens",
    rolloutOrder: 14,
    notes: ["EU VAT/compliance review required before live provider apply."],
    ...SOURCE_ONLY_FLAGS,
  },
] as const;

/**
 * 21-country correction: AU, SG and LU are no longer launch markets and their
 * Phase D targets were removed (docs/21-COUNTRY-MARKET-CORRECTION-PLAN.md).
 */
export const PHASE_D_REMOVED_LOCALES = ["fr-LU", "en-AU", "en-SG"] as const;

export function phaseDTargetForLocale(locale: string): PhaseDLocaleTarget | null {
  const normalized = String(locale ?? "").trim();
  return PHASE_D_RICH_MARKET_TARGETS.find((target) => target.locale === normalized) ?? null;
}

export function phaseDTargetsByRolloutOrder(): readonly PhaseDLocaleTarget[] {
  return [...PHASE_D_RICH_MARKET_TARGETS].sort((a, b) => a.rolloutOrder - b.rolloutOrder);
}
