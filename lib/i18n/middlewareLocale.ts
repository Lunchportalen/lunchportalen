/** Edge-safe locale helpers (no server-only imports). */

import {
  DEFAULT_APP_LOCALE,
  parseAppLocale,
  type AppLocale,
} from "@/lib/i18n/localeRegistry";

export {
  APP_LOCALES,
  DEFAULT_APP_LOCALE,
  getLocaleLabel,
  htmlLangForAppLocale,
  intlLocaleForAppLocale,
  isAppLocale,
  isProfilePersistLocale,
  parseAppLocale,
  PROFILE_PERSIST_LOCALES,
  type AppLocale,
  type ProfilePersistLocale,
} from "@/lib/i18n/localeRegistry";

export const LP_LOCALE_COOKIE = "lp_locale";

export function resolveLocaleFromCookie(cookieValue: string | null | undefined): AppLocale {
  return parseAppLocale(cookieValue) ?? DEFAULT_APP_LOCALE;
}
