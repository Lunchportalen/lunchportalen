/** Edge-safe global app locale registry (no server-only imports). */

export const APP_LOCALES = ["nb", "en", "sv", "da", "fi", "de", "fr", "es"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_APP_LOCALE: AppLocale = "nb";

export const LOCALE_REGISTRY: Record<
  AppLocale,
  { label: string; htmlLang: string; intl: string }
> = {
  nb: { label: "Norsk", htmlLang: "nb", intl: "nb-NO" },
  en: { label: "English", htmlLang: "en-GB", intl: "en-GB" },
  sv: { label: "Svenska", htmlLang: "sv-SE", intl: "sv-SE" },
  da: { label: "Dansk", htmlLang: "da-DK", intl: "da-DK" },
  fi: { label: "Suomi", htmlLang: "fi-FI", intl: "fi-FI" },
  de: { label: "Deutsch", htmlLang: "de-DE", intl: "de-DE" },
  fr: { label: "Français", htmlLang: "fr-FR", intl: "fr-FR" },
  es: { label: "Español", htmlLang: "es-ES", intl: "es-ES" },
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
