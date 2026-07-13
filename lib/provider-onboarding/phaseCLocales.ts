/**
 * Phase C — 9-country launch targets (canonical locale/profile/country/currency/timezone).
 * Planning catalog only — not runtime SOT.
 */

import type { MenuProfileId } from "@/lib/menu-profile/types";

export type PhaseCLocaleTarget = {
  locale: string;
  menuProfileId: MenuProfileId;
  country: string;
  currency: string;
  timezone: string;
  market: string;
  recommendedProviderSlug: string;
  recommendedProviderName: string;
  /** Rollout sequence among remaining locales (1 = next). Covered locales use 0. */
  rolloutOrder: number;
  coverage: "covered" | "pending";
  knownProviderId: string | null;
};

/** Production providers already proven — never mutate via Phase C onboarding factory. */
export const PHASE_C_PROTECTED_PROVIDER_IDS = [
  "11111111-1111-1111-1111-111111111111", // Melhus Catering AS
  "a08e4742-c89d-48c5-a6a8-cf8532179083", // Swedish Lunch Pilot
] as const;

export const PHASE_C_PROTECTED_PROVIDER_SLUGS = [
  "melhus-catering",
  "swedish-lunch-pilot",
] as const;

export const PHASE_C_REQUIRED_GLOBAL_TEMPLATES = [
  "paasmurt",
  "salatboks",
  "sushi",
  "pokebowl",
  "thaimat",
  "vegetarian",
  "varmrett",
] as const;

export const PHASE_C_ONBOARD_CONFIRMATION_PHRASE = "ONBOARD_PROVIDER_APPLY";

/** Recommended far-future safe weeks for remaining locales (not near-term). */
export const PHASE_C_SAFE_FUTURE_WEEKS: Readonly<Record<string, string>> = {
  "da-DK": "2031-11-03",
  "fi-FI": "2031-11-10",
  "en-GB": "2031-11-17",
  "de-DE": "2031-11-24",
  "fr-FR": "2031-12-01",
  "es-ES": "2031-12-08",
  "it-IT": "2031-12-15",
};

export const PHASE_C_LAUNCH_LOCALES: readonly PhaseCLocaleTarget[] = [
  {
    locale: "nb-NO",
    menuProfileId: "norwegian_company_lunch",
    country: "NO",
    currency: `${"NO"}K`,
    timezone: "Europe/Oslo",
    market: "NO",
    recommendedProviderSlug: "melhus-catering",
    recommendedProviderName: "Melhus Catering AS",
    rolloutOrder: 0,
    coverage: "covered",
    knownProviderId: "11111111-1111-1111-1111-111111111111",
  },
  {
    locale: "sv-SE",
    menuProfileId: "swedish_lunch",
    country: "SE",
    currency: "SEK",
    timezone: "Europe/Stockholm",
    market: "SE",
    recommendedProviderSlug: "swedish-lunch-pilot",
    recommendedProviderName: "Swedish Lunch Pilot",
    rolloutOrder: 0,
    coverage: "covered",
    knownProviderId: "a08e4742-c89d-48c5-a6a8-cf8532179083",
  },
  {
    locale: "da-DK",
    menuProfileId: "danish_office_lunch",
    country: "DK",
    currency: "DKK",
    timezone: "Europe/Copenhagen",
    market: "DK",
    recommendedProviderSlug: "danish-lunch-pilot",
    recommendedProviderName: "Danish Lunch Pilot",
    rolloutOrder: 1,
    coverage: "pending",
    knownProviderId: null,
  },
  {
    locale: "fi-FI",
    menuProfileId: "finnish_office_lunch",
    country: "FI",
    currency: "EUR",
    timezone: "Europe/Helsinki",
    market: "FI",
    recommendedProviderSlug: "finnish-lunch-pilot",
    recommendedProviderName: "Finnish Lunch Pilot",
    rolloutOrder: 2,
    coverage: "pending",
    knownProviderId: null,
  },
  {
    locale: "en-GB",
    menuProfileId: "uk_office_lunch",
    country: "GB",
    currency: "GBP",
    timezone: "Europe/London",
    market: "GB",
    recommendedProviderSlug: "uk-lunch-pilot",
    recommendedProviderName: "UK Lunch Pilot",
    rolloutOrder: 3,
    coverage: "pending",
    knownProviderId: null,
  },
  {
    locale: "de-DE",
    menuProfileId: "german_business_lunch",
    country: "DE",
    currency: "EUR",
    timezone: "Europe/Berlin",
    market: "DE",
    recommendedProviderSlug: "german-lunch-pilot",
    recommendedProviderName: "German Lunch Pilot",
    rolloutOrder: 4,
    coverage: "pending",
    knownProviderId: null,
  },
  {
    locale: "fr-FR",
    menuProfileId: "french_dejeuner",
    country: "FR",
    currency: "EUR",
    timezone: "Europe/Paris",
    market: "FR",
    recommendedProviderSlug: "french-lunch-pilot",
    recommendedProviderName: "French Lunch Pilot",
    rolloutOrder: 5,
    coverage: "pending",
    knownProviderId: null,
  },
  {
    locale: "es-ES",
    menuProfileId: "spanish_menu_del_dia",
    country: "ES",
    currency: "EUR",
    timezone: "Europe/Madrid",
    market: "ES",
    recommendedProviderSlug: "spanish-lunch-pilot",
    recommendedProviderName: "Spanish Lunch Pilot",
    rolloutOrder: 6,
    coverage: "pending",
    knownProviderId: null,
  },
  {
    locale: "it-IT",
    menuProfileId: "italian_office_lunch",
    country: "IT",
    currency: "EUR",
    timezone: "Europe/Rome",
    market: "IT",
    recommendedProviderSlug: "italian-lunch-pilot",
    recommendedProviderName: "Italian Lunch Pilot",
    rolloutOrder: 7,
    coverage: "pending",
    knownProviderId: null,
  },
] as const;

export function phaseCTargetForLocale(locale: string): PhaseCLocaleTarget | null {
  const normalized = String(locale ?? "").trim();
  return PHASE_C_LAUNCH_LOCALES.find((t) => t.locale === normalized) ?? null;
}

export function phaseCPendingRolloutOrder(): PhaseCLocaleTarget[] {
  return PHASE_C_LAUNCH_LOCALES.filter((t) => t.coverage === "pending").slice().sort(
    (a, b) => a.rolloutOrder - b.rolloutOrder,
  );
}
