import { DEFAULT_APP_LOCALE, parseAppLocale, type AppLocale } from "@/lib/i18n/middlewareLocale";

export type ResolveAppLocaleInput = {
  cookie?: string | null;
  profile?: string | null;
};

/**
 * Resolution order (locked): cookie → profile → default nb.
 */
export function resolveAppLocale(input: ResolveAppLocaleInput): AppLocale {
  const fromCookie = parseAppLocale(input.cookie);
  if (fromCookie) return fromCookie;

  const fromProfile = parseAppLocale(input.profile);
  if (fromProfile) return fromProfile;

  return DEFAULT_APP_LOCALE;
}
