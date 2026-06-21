/** Edge-safe locale helpers (no server-only imports). */

export const LP_LOCALE_COOKIE = "lp_locale";

export const APP_LOCALES = ["nb", "en"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_APP_LOCALE: AppLocale = "nb";

export function parseAppLocale(raw: string | null | undefined): AppLocale | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "nb" || s === "en") return s;
  return null;
}

export function resolveLocaleFromCookie(cookieValue: string | null | undefined): AppLocale {
  return parseAppLocale(cookieValue) ?? DEFAULT_APP_LOCALE;
}

export function htmlLangForAppLocale(locale: AppLocale): string {
  return locale === "en" ? "en-GB" : "nb";
}

export function intlLocaleForAppLocale(locale: AppLocale): string {
  return locale === "en" ? "en-GB" : "nb-NO";
}
