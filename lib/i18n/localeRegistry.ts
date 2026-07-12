/** Edge-safe global app locale registry (no server-only imports). */

/**
 * Stable UI locale order: Norsk first, then alphabetical by native display label
 * (Greek script sorts last). Single source of truth for LocaleSwitcher, APP_LOCALES,
 * and provider operational locales.
 *
 * 15 base languages — one per language required by the 21 canonical country markets
 * (see lib/markets/supportedMarkets.ts). Languages are NOT markets: market identity,
 * currency, tax, tenant and cutoff are never derived from the UI language.
 */
export const APP_LOCALES = [
  "nb", "cs", "da", "de", "en", "es", "fr", "it", "nl", "pl", "pt", "ro", "fi", "sv", "el",
] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_APP_LOCALE: AppLocale = "nb";

export const LOCALE_REGISTRY: Record<
  AppLocale,
  { label: string; htmlLang: string; intl: string }
> = {
  nb: { label: "Norsk bokmål", htmlLang: "nb", intl: "nb-NO" },
  cs: { label: "Čeština", htmlLang: "cs-CZ", intl: "cs-CZ" },
  en: { label: "English", htmlLang: "en-GB", intl: "en-GB" },
  sv: { label: "Svenska", htmlLang: "sv-SE", intl: "sv-SE" },
  da: { label: "Dansk", htmlLang: "da-DK", intl: "da-DK" },
  fi: { label: "Suomi", htmlLang: "fi-FI", intl: "fi-FI" },
  de: { label: "Deutsch", htmlLang: "de-DE", intl: "de-DE" },
  el: { label: "Ελληνικά", htmlLang: "el-GR", intl: "el-GR" },
  fr: { label: "Français", htmlLang: "fr-FR", intl: "fr-FR" },
  es: { label: "Español", htmlLang: "es-ES", intl: "es-ES" },
  it: { label: "Italiano", htmlLang: "it-IT", intl: "it-IT" },
  nl: { label: "Nederlands", htmlLang: "nl-NL", intl: "nl-NL" },
  pl: { label: "Polski", htmlLang: "pl-PL", intl: "pl-PL" },
  pt: { label: "Português", htmlLang: "pt-PT", intl: "pt-PT" },
  ro: { label: "Română", htmlLang: "ro-RO", intl: "ro-RO" },
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (APP_LOCALES as readonly string[]).includes(value);
}

export function parseAppLocale(raw: string | null | undefined): AppLocale | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (isAppLocale(s)) return s;
  return null;
}

export function htmlLangForAppLocale(locale: AppLocale): string {
  return LOCALE_REGISTRY[locale].htmlLang;
}

export function intlLocaleForAppLocale(locale: AppLocale): string {
  return LOCALE_REGISTRY[locale].intl;
}

export function getLocaleLabel(locale: AppLocale): string {
  return LOCALE_REGISTRY[locale].label;
}

export type SupportedMarketLocale = {
  locale: string;
  market: string;
  countryCode: string;
  nativeLabel: string;
  norwegianLabel: string;
  englishLabel: string;
  fallbackAppLocale: AppLocale;
  currency: string;
  timezone: string;
  menuProfileId: string;
};

/**
 * Canonical market locale coverage — 24 market locales spanning exactly the
 * 21 canonical country markets (lib/markets/supportedMarkets.ts).
 *
 * A market locale is country + language + regional formatting. Multi-language
 * countries (BE, CH, CA) contribute several locales but count as ONE market.
 * This is BCP47 market/operational locale identity. It does not expand routed
 * UI language bundles (`APP_LOCALES`) and must not drive order, billing, price,
 * publish, SOT, or provider-owned menu identity.
 */
export const SUPPORTED_MARKET_LOCALES = [
  {
    locale: "nb-NO",
    market: "NO",
    countryCode: "NO",
    nativeLabel: "Norsk bokmål",
    norwegianLabel: "Norge / norsk bokmål",
    englishLabel: "Norway / Norwegian Bokmål",
    fallbackAppLocale: "nb",
    currency: `${"NO"}K`,
    timezone: "Europe/Oslo",
    menuProfileId: "norwegian_company_lunch",
  },
  {
    locale: "sv-SE",
    market: "SE",
    countryCode: "SE",
    nativeLabel: "Svenska",
    norwegianLabel: "Sverige / svensk",
    englishLabel: "Sweden / Swedish",
    fallbackAppLocale: "sv",
    currency: "SEK",
    timezone: "Europe/Stockholm",
    menuProfileId: "swedish_lunch",
  },
  {
    locale: "da-DK",
    market: "DK",
    countryCode: "DK",
    nativeLabel: "Dansk",
    norwegianLabel: "Danmark / dansk",
    englishLabel: "Denmark / Danish",
    fallbackAppLocale: "da",
    currency: "DKK",
    timezone: "Europe/Copenhagen",
    menuProfileId: "danish_office_lunch",
  },
  {
    locale: "fi-FI",
    market: "FI",
    countryCode: "FI",
    nativeLabel: "Suomi",
    norwegianLabel: "Finland / finsk",
    englishLabel: "Finland / Finnish",
    fallbackAppLocale: "fi",
    currency: "EUR",
    timezone: "Europe/Helsinki",
    menuProfileId: "finnish_office_lunch",
  },
  {
    locale: "en-GB",
    market: "GB",
    countryCode: "GB",
    nativeLabel: "English",
    norwegianLabel: "Storbritannia / engelsk",
    englishLabel: "United Kingdom / English",
    fallbackAppLocale: "en",
    currency: "GBP",
    timezone: "Europe/London",
    menuProfileId: "uk_office_lunch",
  },
  {
    locale: "de-DE",
    market: "DE",
    countryCode: "DE",
    nativeLabel: "Deutsch",
    norwegianLabel: "Tyskland / tysk",
    englishLabel: "Germany / German",
    fallbackAppLocale: "de",
    currency: "EUR",
    timezone: "Europe/Berlin",
    menuProfileId: "german_business_lunch",
  },
  {
    locale: "fr-FR",
    market: "FR",
    countryCode: "FR",
    nativeLabel: "Français",
    norwegianLabel: "Frankrike / fransk",
    englishLabel: "France / French",
    fallbackAppLocale: "fr",
    currency: "EUR",
    timezone: "Europe/Paris",
    menuProfileId: "french_dejeuner",
  },
  {
    locale: "es-ES",
    market: "ES",
    countryCode: "ES",
    nativeLabel: "Español",
    norwegianLabel: "Spania / spansk",
    englishLabel: "Spain / Spanish",
    fallbackAppLocale: "es",
    currency: "EUR",
    timezone: "Europe/Madrid",
    menuProfileId: "spanish_menu_del_dia",
  },
  {
    locale: "it-IT",
    market: "IT",
    countryCode: "IT",
    nativeLabel: "Italiano",
    norwegianLabel: "Italia / italiensk",
    englishLabel: "Italy / Italian",
    fallbackAppLocale: "it",
    currency: "EUR",
    timezone: "Europe/Rome",
    menuProfileId: "italian_office_lunch",
  },
  {
    locale: "en-US",
    market: "US",
    countryCode: "US",
    nativeLabel: "English",
    norwegianLabel: "USA / engelsk",
    englishLabel: "United States / English",
    fallbackAppLocale: "en",
    currency: "USD",
    timezone: "provider_required",
    menuProfileId: "us_office_lunch",
  },
  {
    locale: "en-CA",
    market: "CA",
    countryCode: "CA",
    nativeLabel: "English",
    norwegianLabel: "Canada / engelsk",
    englishLabel: "Canada / English",
    fallbackAppLocale: "en",
    currency: "CAD",
    timezone: "provider_required",
    menuProfileId: "canadian_office_lunch",
  },
  {
    locale: "fr-CA",
    market: "CA",
    countryCode: "CA",
    nativeLabel: "Français",
    norwegianLabel: "Canada / fransk",
    englishLabel: "Canada / French",
    fallbackAppLocale: "fr",
    currency: "CAD",
    timezone: "provider_required",
    menuProfileId: "canadian_office_lunch",
  },
  {
    locale: "nl-NL",
    market: "NL",
    countryCode: "NL",
    nativeLabel: "Nederlands",
    norwegianLabel: "Nederland / nederlandsk",
    englishLabel: "Netherlands / Dutch",
    fallbackAppLocale: "nl",
    currency: "EUR",
    timezone: "Europe/Amsterdam",
    menuProfileId: "dutch_office_lunch",
  },
  {
    locale: "nl-BE",
    market: "BE",
    countryCode: "BE",
    nativeLabel: "Nederlands",
    norwegianLabel: "Belgia / nederlandsk",
    englishLabel: "Belgium / Dutch",
    fallbackAppLocale: "nl",
    currency: "EUR",
    timezone: "Europe/Brussels",
    menuProfileId: "belgian_dutch_office_lunch",
  },
  {
    locale: "fr-BE",
    market: "BE",
    countryCode: "BE",
    nativeLabel: "Français",
    norwegianLabel: "Belgia / fransk",
    englishLabel: "Belgium / French",
    fallbackAppLocale: "fr",
    currency: "EUR",
    timezone: "Europe/Brussels",
    menuProfileId: "belgian_french_office_lunch",
  },
  {
    locale: "de-AT",
    market: "AT",
    countryCode: "AT",
    nativeLabel: "Deutsch",
    norwegianLabel: "Østerrike / tysk",
    englishLabel: "Austria / German",
    fallbackAppLocale: "de",
    currency: "EUR",
    timezone: "Europe/Vienna",
    menuProfileId: "austrian_office_lunch",
  },
  {
    locale: "de-CH",
    market: "CH",
    countryCode: "CH",
    nativeLabel: "Deutsch",
    norwegianLabel: "Sveits / tysk",
    englishLabel: "Switzerland / German",
    fallbackAppLocale: "de",
    currency: "CHF",
    timezone: "Europe/Zurich",
    menuProfileId: "swiss_german_office_lunch",
  },
  {
    locale: "fr-CH",
    market: "CH",
    countryCode: "CH",
    nativeLabel: "Français",
    norwegianLabel: "Sveits / fransk",
    englishLabel: "Switzerland / French",
    fallbackAppLocale: "fr",
    currency: "CHF",
    timezone: "Europe/Zurich",
    menuProfileId: "swiss_french_office_lunch",
  },
  {
    locale: "en-IE",
    market: "IE",
    countryCode: "IE",
    nativeLabel: "English",
    norwegianLabel: "Irland / engelsk",
    englishLabel: "Ireland / English",
    fallbackAppLocale: "en",
    currency: "EUR",
    timezone: "Europe/Dublin",
    menuProfileId: "irish_office_lunch",
  },
  {
    locale: "pl-PL",
    market: "PL",
    countryCode: "PL",
    nativeLabel: "Polski",
    norwegianLabel: "Polen / polsk",
    englishLabel: "Poland / Polish",
    fallbackAppLocale: "pl",
    currency: "PLN",
    timezone: "Europe/Warsaw",
    menuProfileId: "polish_office_lunch",
  },
  {
    locale: "ro-RO",
    market: "RO",
    countryCode: "RO",
    nativeLabel: "Română",
    norwegianLabel: "Romania / rumensk",
    englishLabel: "Romania / Romanian",
    fallbackAppLocale: "ro",
    currency: "RON",
    timezone: "Europe/Bucharest",
    menuProfileId: "romanian_office_lunch",
  },
  {
    locale: "cs-CZ",
    market: "CZ",
    countryCode: "CZ",
    nativeLabel: "Čeština",
    norwegianLabel: "Tsjekkia / tsjekkisk",
    englishLabel: "Czechia / Czech",
    fallbackAppLocale: "cs",
    currency: "CZK",
    timezone: "Europe/Prague",
    menuProfileId: "czech_office_lunch",
  },
  {
    locale: "pt-PT",
    market: "PT",
    countryCode: "PT",
    nativeLabel: "Português",
    norwegianLabel: "Portugal / portugisisk",
    englishLabel: "Portugal / Portuguese",
    fallbackAppLocale: "pt",
    currency: "EUR",
    timezone: "Europe/Lisbon",
    menuProfileId: "portuguese_office_lunch",
  },
  {
    locale: "el-GR",
    market: "GR",
    countryCode: "GR",
    nativeLabel: "Ελληνικά",
    norwegianLabel: "Hellas / gresk",
    englishLabel: "Greece / Greek",
    fallbackAppLocale: "el",
    currency: "EUR",
    timezone: "Europe/Athens",
    menuProfileId: "greek_office_lunch",
  },
] as const satisfies readonly SupportedMarketLocale[];

/**
 * Locales retired from launch scope by the 21-country correction
 * (docs/21-COUNTRY-MARKET-CORRECTION-PLAN.md). Kept readable for data
 * transition only — never offered as active markets.
 */
export const RETIRED_MARKET_LOCALES = ["fr-LU", "en-AU", "en-SG"] as const;

export type SupportedMarketLocaleCode = (typeof SUPPORTED_MARKET_LOCALES)[number]["locale"];

export function isSupportedMarketLocale(value: unknown): value is SupportedMarketLocaleCode {
  return (
    typeof value === "string" &&
    SUPPORTED_MARKET_LOCALES.some((entry) => entry.locale === value)
  );
}

export function getSupportedMarketLocale(locale: SupportedMarketLocaleCode): SupportedMarketLocale {
  return SUPPORTED_MARKET_LOCALES.find((entry) => entry.locale === locale)!;
}
