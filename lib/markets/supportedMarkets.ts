/**
 * CANONICAL 21-COUNTRY MARKET MODEL (edge-safe; no server-only imports).
 *
 * This is the single source of truth for Lunchportalen's market countries.
 * It corrects the earlier flawed "21 distinct locales = 21 markets" model.
 *
 * Three explicitly separated models (never conflated):
 *   A. MarketCountry   — exactly 21 country codes (one row per country).
 *   B. SupportedLanguage — languages a user can choose (UI text).
 *   C. MarketLocale    — country + language + regional Intl formatting.
 *
 * Language choice NEVER changes country, currency, tax, provider, price,
 * tenant, contract, cutoff or payment rules. Those come from the market/contract.
 */

/* =========================================================
   A. MarketCountry — the 21 canonical countries
========================================================= */

export const SUPPORTED_COUNTRY_CODES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
] as const;

export type CountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

export type TimezoneStrategy = "fixed" | "provider_required";
export type TaxStrategy = "vat" | "sales_tax" | "gst";
export type PostalCodeStrategy = "numeric4" | "numeric5" | "alphanumeric" | "alphanumeric_space";

export type MarketCountry = {
  countryCode: CountryCode;
  marketName: string;
  region: "europe" | "north_america";
  primaryLanguage: SupportedLanguageCode;
  supportedLanguages: readonly SupportedLanguageCode[];
  defaultLocale: MarketLocaleCode;
  supportedLocales: readonly MarketLocaleCode[];
  currency: string;
  timezoneStrategy: TimezoneStrategy;
  /** Present only when a single timezone is defensible; provider_required markets set null. */
  defaultTimezone: string | null;
  taxStrategy: TaxStrategy;
  invoiceLocale: MarketLocaleCode;
  menuProfileId: string;
  addressFormat: string;
  phoneCountryCode: string;
  postalCodeStrategy: PostalCodeStrategy;
  enabled: boolean;
};

/* =========================================================
   B. SupportedLanguage — user-selectable UI languages
========================================================= */

export const SUPPORTED_LANGUAGES = [
  "nb", "sv", "da", "fi", "en", "de", "fr", "es", "it", "nl",
  "pl", "ro", "cs", "pt", "el",
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const SUPPORTED_LANGUAGE_LABELS: Record<SupportedLanguageCode, string> = {
  nb: "Norsk bokmål",
  sv: "Svenska",
  da: "Dansk",
  fi: "Suomi",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  ro: "Română",
  cs: "Čeština",
  pt: "Português",
  el: "Ελληνικά",
};

/* =========================================================
   C. MarketLocale — country + language + Intl formatting
========================================================= */

export const MARKET_LOCALE_CODES = [
  "nb-NO", "sv-SE", "da-DK", "fi-FI", "en-GB", "de-DE", "fr-FR", "es-ES", "it-IT",
  "nl-NL", "nl-BE", "fr-BE", "de-CH", "fr-CH", "de-AT", "en-IE", "pl-PL", "ro-RO",
  "cs-CZ", "pt-PT", "el-GR", "en-US", "en-CA", "fr-CA",
] as const;

export type MarketLocaleCode = (typeof MARKET_LOCALE_CODES)[number];

export type MarketLocale = {
  locale: MarketLocaleCode;
  countryCode: CountryCode;
  language: SupportedLanguageCode;
  intlLocale: string;
};

/**
 * Every market locale binds to one country + one base language + its Intl locale.
 * Regional variants (en-GB/en-US/en-CA, de-DE/de-AT/de-CH, fr-FR/fr-BE/fr-CH/fr-CA,
 * nl-NL/nl-BE) share a base language catalog but format dates/numbers/currency per market.
 */
export const MARKET_LOCALES: readonly MarketLocale[] = [
  { locale: "nb-NO", countryCode: "NO", language: "nb", intlLocale: "nb-NO" },
  { locale: "sv-SE", countryCode: "SE", language: "sv", intlLocale: "sv-SE" },
  { locale: "da-DK", countryCode: "DK", language: "da", intlLocale: "da-DK" },
  { locale: "fi-FI", countryCode: "FI", language: "fi", intlLocale: "fi-FI" },
  { locale: "en-GB", countryCode: "GB", language: "en", intlLocale: "en-GB" },
  { locale: "de-DE", countryCode: "DE", language: "de", intlLocale: "de-DE" },
  { locale: "fr-FR", countryCode: "FR", language: "fr", intlLocale: "fr-FR" },
  { locale: "es-ES", countryCode: "ES", language: "es", intlLocale: "es-ES" },
  { locale: "it-IT", countryCode: "IT", language: "it", intlLocale: "it-IT" },
  { locale: "nl-NL", countryCode: "NL", language: "nl", intlLocale: "nl-NL" },
  { locale: "nl-BE", countryCode: "BE", language: "nl", intlLocale: "nl-BE" },
  { locale: "fr-BE", countryCode: "BE", language: "fr", intlLocale: "fr-BE" },
  { locale: "de-CH", countryCode: "CH", language: "de", intlLocale: "de-CH" },
  { locale: "fr-CH", countryCode: "CH", language: "fr", intlLocale: "fr-CH" },
  { locale: "de-AT", countryCode: "AT", language: "de", intlLocale: "de-AT" },
  { locale: "en-IE", countryCode: "IE", language: "en", intlLocale: "en-IE" },
  { locale: "pl-PL", countryCode: "PL", language: "pl", intlLocale: "pl-PL" },
  { locale: "ro-RO", countryCode: "RO", language: "ro", intlLocale: "ro-RO" },
  { locale: "cs-CZ", countryCode: "CZ", language: "cs", intlLocale: "cs-CZ" },
  { locale: "pt-PT", countryCode: "PT", language: "pt", intlLocale: "pt-PT" },
  { locale: "el-GR", countryCode: "GR", language: "el", intlLocale: "el-GR" },
  { locale: "en-US", countryCode: "US", language: "en", intlLocale: "en-US" },
  { locale: "en-CA", countryCode: "CA", language: "en", intlLocale: "en-CA" },
  { locale: "fr-CA", countryCode: "CA", language: "fr", intlLocale: "fr-CA" },
];

/* =========================================================
   The 21 canonical markets
========================================================= */

export const SUPPORTED_MARKETS: readonly MarketCountry[] = [
  { countryCode: "NO", marketName: "Norge", region: "europe", primaryLanguage: "nb", supportedLanguages: ["nb", "en"], defaultLocale: "nb-NO", supportedLocales: ["nb-NO"], currency: `${"NO"}K`, timezoneStrategy: "fixed", defaultTimezone: "Europe/Oslo", taxStrategy: "vat", invoiceLocale: "nb-NO", menuProfileId: "norwegian_company_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+47", postalCodeStrategy: "numeric4", enabled: true },
  { countryCode: "SE", marketName: "Sverige", region: "europe", primaryLanguage: "sv", supportedLanguages: ["sv", "en"], defaultLocale: "sv-SE", supportedLocales: ["sv-SE"], currency: "SEK", timezoneStrategy: "fixed", defaultTimezone: "Europe/Stockholm", taxStrategy: "vat", invoiceLocale: "sv-SE", menuProfileId: "swedish_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+46", postalCodeStrategy: "numeric5", enabled: true },
  { countryCode: "DK", marketName: "Danmark", region: "europe", primaryLanguage: "da", supportedLanguages: ["da", "en"], defaultLocale: "da-DK", supportedLocales: ["da-DK"], currency: "DKK", timezoneStrategy: "fixed", defaultTimezone: "Europe/Copenhagen", taxStrategy: "vat", invoiceLocale: "da-DK", menuProfileId: "danish_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+45", postalCodeStrategy: "numeric4", enabled: true },
  { countryCode: "FI", marketName: "Finland", region: "europe", primaryLanguage: "fi", supportedLanguages: ["fi", "sv", "en"], defaultLocale: "fi-FI", supportedLocales: ["fi-FI"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Helsinki", taxStrategy: "vat", invoiceLocale: "fi-FI", menuProfileId: "finnish_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+358", postalCodeStrategy: "numeric5", enabled: true },
  { countryCode: "GB", marketName: "Storbritannia", region: "europe", primaryLanguage: "en", supportedLanguages: ["en"], defaultLocale: "en-GB", supportedLocales: ["en-GB"], currency: "GBP", timezoneStrategy: "fixed", defaultTimezone: "Europe/London", taxStrategy: "vat", invoiceLocale: "en-GB", menuProfileId: "uk_office_lunch", addressFormat: "street_city_postal", phoneCountryCode: "+44", postalCodeStrategy: "alphanumeric_space", enabled: true },
  { countryCode: "DE", marketName: "Tyskland", region: "europe", primaryLanguage: "de", supportedLanguages: ["de", "en"], defaultLocale: "de-DE", supportedLocales: ["de-DE"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Berlin", taxStrategy: "vat", invoiceLocale: "de-DE", menuProfileId: "german_business_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+49", postalCodeStrategy: "numeric5", enabled: true },
  { countryCode: "FR", marketName: "Frankrike", region: "europe", primaryLanguage: "fr", supportedLanguages: ["fr", "en"], defaultLocale: "fr-FR", supportedLocales: ["fr-FR"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Paris", taxStrategy: "vat", invoiceLocale: "fr-FR", menuProfileId: "french_dejeuner", addressFormat: "street_postal_city", phoneCountryCode: "+33", postalCodeStrategy: "numeric5", enabled: true },
  { countryCode: "ES", marketName: "Spania", region: "europe", primaryLanguage: "es", supportedLanguages: ["es", "en"], defaultLocale: "es-ES", supportedLocales: ["es-ES"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Madrid", taxStrategy: "vat", invoiceLocale: "es-ES", menuProfileId: "spanish_menu_del_dia", addressFormat: "street_postal_city", phoneCountryCode: "+34", postalCodeStrategy: "numeric5", enabled: true },
  { countryCode: "IT", marketName: "Italia", region: "europe", primaryLanguage: "it", supportedLanguages: ["it", "en"], defaultLocale: "it-IT", supportedLocales: ["it-IT"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Rome", taxStrategy: "vat", invoiceLocale: "it-IT", menuProfileId: "italian_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+39", postalCodeStrategy: "numeric5", enabled: true },
  { countryCode: "NL", marketName: "Nederland", region: "europe", primaryLanguage: "nl", supportedLanguages: ["nl", "en"], defaultLocale: "nl-NL", supportedLocales: ["nl-NL"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Amsterdam", taxStrategy: "vat", invoiceLocale: "nl-NL", menuProfileId: "dutch_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+31", postalCodeStrategy: "alphanumeric_space", enabled: true },
  { countryCode: "BE", marketName: "Belgia", region: "europe", primaryLanguage: "nl", supportedLanguages: ["nl", "fr", "en"], defaultLocale: "nl-BE", supportedLocales: ["nl-BE", "fr-BE"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Brussels", taxStrategy: "vat", invoiceLocale: "nl-BE", menuProfileId: "belgian_dutch_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+32", postalCodeStrategy: "numeric4", enabled: true },
  { countryCode: "CH", marketName: "Sveits", region: "europe", primaryLanguage: "de", supportedLanguages: ["de", "fr", "it", "en"], defaultLocale: "de-CH", supportedLocales: ["de-CH", "fr-CH"], currency: "CHF", timezoneStrategy: "fixed", defaultTimezone: "Europe/Zurich", taxStrategy: "vat", invoiceLocale: "de-CH", menuProfileId: "swiss_german_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+41", postalCodeStrategy: "numeric4", enabled: true },
  { countryCode: "AT", marketName: "Østerrike", region: "europe", primaryLanguage: "de", supportedLanguages: ["de", "en"], defaultLocale: "de-AT", supportedLocales: ["de-AT"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Vienna", taxStrategy: "vat", invoiceLocale: "de-AT", menuProfileId: "austrian_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+43", postalCodeStrategy: "numeric4", enabled: true },
  { countryCode: "IE", marketName: "Irland", region: "europe", primaryLanguage: "en", supportedLanguages: ["en"], defaultLocale: "en-IE", supportedLocales: ["en-IE"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Dublin", taxStrategy: "vat", invoiceLocale: "en-IE", menuProfileId: "irish_office_lunch", addressFormat: "street_city_postal", phoneCountryCode: "+353", postalCodeStrategy: "alphanumeric_space", enabled: true },
  { countryCode: "PL", marketName: "Polen", region: "europe", primaryLanguage: "pl", supportedLanguages: ["pl", "en"], defaultLocale: "pl-PL", supportedLocales: ["pl-PL"], currency: "PLN", timezoneStrategy: "fixed", defaultTimezone: "Europe/Warsaw", taxStrategy: "vat", invoiceLocale: "pl-PL", menuProfileId: "polish_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+48", postalCodeStrategy: "alphanumeric", enabled: true },
  { countryCode: "RO", marketName: "Romania", region: "europe", primaryLanguage: "ro", supportedLanguages: ["ro", "en"], defaultLocale: "ro-RO", supportedLocales: ["ro-RO"], currency: "RON", timezoneStrategy: "fixed", defaultTimezone: "Europe/Bucharest", taxStrategy: "vat", invoiceLocale: "ro-RO", menuProfileId: "romanian_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+40", postalCodeStrategy: "numeric5", enabled: true },
  { countryCode: "CZ", marketName: "Tsjekkia", region: "europe", primaryLanguage: "cs", supportedLanguages: ["cs", "en"], defaultLocale: "cs-CZ", supportedLocales: ["cs-CZ"], currency: "CZK", timezoneStrategy: "fixed", defaultTimezone: "Europe/Prague", taxStrategy: "vat", invoiceLocale: "cs-CZ", menuProfileId: "czech_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+420", postalCodeStrategy: "alphanumeric_space", enabled: true },
  { countryCode: "PT", marketName: "Portugal", region: "europe", primaryLanguage: "pt", supportedLanguages: ["pt", "en"], defaultLocale: "pt-PT", supportedLocales: ["pt-PT"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Lisbon", taxStrategy: "vat", invoiceLocale: "pt-PT", menuProfileId: "portuguese_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+351", postalCodeStrategy: "alphanumeric_space", enabled: true },
  { countryCode: "GR", marketName: "Hellas", region: "europe", primaryLanguage: "el", supportedLanguages: ["el", "en"], defaultLocale: "el-GR", supportedLocales: ["el-GR"], currency: "EUR", timezoneStrategy: "fixed", defaultTimezone: "Europe/Athens", taxStrategy: "vat", invoiceLocale: "el-GR", menuProfileId: "greek_office_lunch", addressFormat: "street_postal_city", phoneCountryCode: "+30", postalCodeStrategy: "alphanumeric_space", enabled: true },
  { countryCode: "US", marketName: "USA", region: "north_america", primaryLanguage: "en", supportedLanguages: ["en"], defaultLocale: "en-US", supportedLocales: ["en-US"], currency: "USD", timezoneStrategy: "provider_required", defaultTimezone: null, taxStrategy: "sales_tax", invoiceLocale: "en-US", menuProfileId: "us_office_lunch", addressFormat: "street_city_state_zip", phoneCountryCode: "+1", postalCodeStrategy: "numeric5", enabled: true },
  { countryCode: "CA", marketName: "Canada", region: "north_america", primaryLanguage: "en", supportedLanguages: ["en", "fr"], defaultLocale: "en-CA", supportedLocales: ["en-CA", "fr-CA"], currency: "CAD", timezoneStrategy: "provider_required", defaultTimezone: null, taxStrategy: "gst", invoiceLocale: "en-CA", menuProfileId: "canadian_office_lunch", addressFormat: "street_city_province_postal", phoneCountryCode: "+1", postalCodeStrategy: "alphanumeric_space", enabled: true },
];

/* =========================================================
   Lookups / guards
========================================================= */

const MARKET_BY_COUNTRY = new Map<string, MarketCountry>(SUPPORTED_MARKETS.map((m) => [m.countryCode, m]));
const LOCALE_INDEX = new Map<string, MarketLocale>(MARKET_LOCALES.map((l) => [l.locale, l]));

export function isSupportedCountry(value: unknown): value is CountryCode {
  return typeof value === "string" && MARKET_BY_COUNTRY.has(value);
}

export function getMarketCountry(countryCode: string): MarketCountry | null {
  return MARKET_BY_COUNTRY.get(String(countryCode ?? "").trim().toUpperCase()) ?? null;
}

export function isSupportedLanguage(value: unknown): value is SupportedLanguageCode {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function isMarketLocale(value: unknown): value is MarketLocaleCode {
  return typeof value === "string" && LOCALE_INDEX.has(value);
}

export function resolveMarketLocale(locale: string): MarketLocale | null {
  return LOCALE_INDEX.get(String(locale ?? "").trim()) ?? null;
}

/** Country for a market locale (locale never determines market identity by itself elsewhere). */
export function countryForLocale(locale: string): CountryCode | null {
  return resolveMarketLocale(locale)?.countryCode ?? null;
}

/** Base UI language for a market locale (text catalog selector). */
export function languageForLocale(locale: string): SupportedLanguageCode | null {
  return resolveMarketLocale(locale)?.language ?? null;
}

export const ENABLED_MARKETS = SUPPORTED_MARKETS.filter((m) => m.enabled);
export const EUROPEAN_MARKETS = SUPPORTED_MARKETS.filter((m) => m.region === "europe");
export const NORTH_AMERICAN_MARKETS = SUPPORTED_MARKETS.filter((m) => m.region === "north_america");

/** Locales explicitly removed from launch scope (retained for read-only data migration). */
export const RETIRED_LAUNCH_LOCALES = ["en-AU", "en-SG", "fr-LU"] as const;
export const RETIRED_LAUNCH_COUNTRIES = ["AU", "SG", "LU"] as const;
