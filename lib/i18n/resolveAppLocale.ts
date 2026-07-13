import { DEFAULT_APP_LOCALE, parseAppLocale, type AppLocale } from "@/lib/i18n/middlewareLocale";
import { SUPPORTED_MARKET_LOCALES } from "@/lib/i18n/localeRegistry";

export type ResolveAppLocaleInput = {
  cookie?: string | null;
  profile?: string | null;
  /** Company default UI locale (companies.preferred_locale). */
  company?: string | null;
  /** ISO country code for the company's market (companies.billing_country). */
  marketCountry?: string | null;
};

/**
 * Market default UI language via the canonical market locale registry.
 * Returns null for unknown countries (chain continues to global fallback).
 */
export function defaultAppLocaleForCountry(countryCode: string | null | undefined): AppLocale | null {
  const cc = String(countryCode ?? "").trim().toUpperCase();
  if (!cc) return null;
  const entry = SUPPORTED_MARKET_LOCALES.find((e) => e.countryCode === cc);
  return entry ? entry.fallbackAppLocale : null;
}

/**
 * Resolution order (locked, Fase E1):
 * explicit user choice (cookie) → user profile → company default → market default → nb.
 *
 * Browser Accept-Language is intentionally NEVER consulted — it must not override
 * explicit user or market configuration.
 */
export function resolveAppLocale(input: ResolveAppLocaleInput): AppLocale {
  const fromCookie = parseAppLocale(input.cookie);
  if (fromCookie) return fromCookie;

  const fromProfile = parseAppLocale(input.profile);
  if (fromProfile) return fromProfile;

  const fromCompany = parseAppLocale(input.company);
  if (fromCompany) return fromCompany;

  const fromMarket = defaultAppLocaleForCountry(input.marketCountry);
  if (fromMarket) return fromMarket;

  return DEFAULT_APP_LOCALE;
}
