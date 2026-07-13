/**
 * Market-locale end-to-end runtime resolution (edge-safe; no server-only imports).
 *
 * The canonical market locales (SUPPORTED_MARKET_LOCALES — 24 locales spanning the
 * 21 canonical country markets) resolve at runtime to:
 *   - a base-language message catalog (the text), and
 *   - a BCP47 Intl locale (date/number/currency/percent formatting per market).
 *
 * This is NOT "market fallback": every market locale is a first-class runtime locale
 * with a complete, resolvable catalog. Regional variants of the same language
 * (en-GB/en-US/en-CA/en-IE, de-DE/de-AT/de-CH, fr-FR/fr-BE/fr-CH/fr-CA, nl-NL/nl-BE)
 * legitimately share base text but format numbers/dates/currency via their own
 * Intl locale. Language NEVER changes market identity, currency, tax or tenant.
 *
 * Base languages (15): nb, sv, da, fi, en, de, fr, es, it, nl, pl, ro, cs, pt, el —
 * one per language required by the 21 country markets.
 */

import { SUPPORTED_MARKET_LOCALES, type SupportedMarketLocaleCode } from "@/lib/i18n/localeRegistry";

/** Base languages that MUST have a complete runtime message catalog. */
export const RUNTIME_BASE_LANGUAGES = [
  "nb", "sv", "da", "fi", "en", "de", "fr", "es", "it", "nl", "pl", "ro", "cs", "pt", "el",
] as const;
export type RuntimeBaseLanguage = (typeof RUNTIME_BASE_LANGUAGES)[number];

export type MarketLocaleRuntime = {
  /** Market/operational BCP47 code (one of the canonical market locales). */
  locale: SupportedMarketLocaleCode;
  /** Base language whose message catalog provides the text. */
  baseLanguage: RuntimeBaseLanguage;
  /** BCP47 locale used for Intl date/number/currency formatting. */
  intlLocale: string;
};

/**
 * Explicit base-language binding per market locale. Every locale binds to its
 * linguistic base language (no English fallback for non-English markets).
 * The Intl locale is always the market locale itself, so formatting stays market-correct.
 */
const MARKET_LOCALE_BASE: Record<SupportedMarketLocaleCode, RuntimeBaseLanguage> = {
  "nb-NO": "nb",
  "sv-SE": "sv",
  "da-DK": "da",
  "fi-FI": "fi",
  "en-GB": "en",
  "de-DE": "de",
  "fr-FR": "fr",
  "es-ES": "es",
  "it-IT": "it",
  "en-US": "en",
  "en-CA": "en",
  "fr-CA": "fr",
  "nl-NL": "nl",
  "nl-BE": "nl",
  "fr-BE": "fr",
  "de-AT": "de",
  "de-CH": "de",
  "fr-CH": "fr",
  "en-IE": "en",
  "pl-PL": "pl",
  "ro-RO": "ro",
  "cs-CZ": "cs",
  "pt-PT": "pt",
  "el-GR": "el",
};

export const MARKET_LOCALE_RUNTIME: readonly MarketLocaleRuntime[] = SUPPORTED_MARKET_LOCALES.map(
  (entry) => ({
    locale: entry.locale,
    baseLanguage: MARKET_LOCALE_BASE[entry.locale],
    intlLocale: entry.locale,
  }),
);

const RUNTIME_BY_LOCALE = new Map<string, MarketLocaleRuntime>(
  MARKET_LOCALE_RUNTIME.map((r) => [r.locale, r]),
);

export function isMarketLocaleCode(value: unknown): value is SupportedMarketLocaleCode {
  return typeof value === "string" && RUNTIME_BY_LOCALE.has(value);
}

/** Resolve a market locale to its runtime binding. Returns null for unknown codes. */
export function resolveMarketLocaleRuntime(locale: string | null | undefined): MarketLocaleRuntime | null {
  const code = String(locale ?? "").trim();
  return RUNTIME_BY_LOCALE.get(code) ?? null;
}

/** Base language for a market locale (text catalog selector). */
export function baseLanguageForMarketLocale(locale: string): RuntimeBaseLanguage | null {
  return resolveMarketLocaleRuntime(locale)?.baseLanguage ?? null;
}

/** Intl locale for a market locale (formatting selector). */
export function intlLocaleForMarketLocale(locale: string): string | null {
  return resolveMarketLocaleRuntime(locale)?.intlLocale ?? null;
}

export function isRuntimeBaseLanguage(value: unknown): value is RuntimeBaseLanguage {
  return typeof value === "string" && (RUNTIME_BASE_LANGUAGES as readonly string[]).includes(value);
}
