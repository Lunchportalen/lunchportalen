import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import { LP_LOCALE_COOKIE, parseAppLocale } from "@/lib/i18n/middlewareLocale";
import { loadLocalePreferencesForRequest } from "@/lib/i18n/profileLocale";
import { resolveAppLocale } from "@/lib/i18n/resolveAppLocale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieValue = cookieStore.get(LP_LOCALE_COOKIE)?.value ?? headerStore.get("x-lp-locale");

  // Fase E1 chain: cookie → profile → company default → market default → nb.
  let prefs: Awaited<ReturnType<typeof loadLocalePreferencesForRequest>> = {
    profile: null,
    company: null,
    marketCountry: null,
  };
  if (!parseAppLocale(cookieValue)) {
    prefs = await loadLocalePreferencesForRequest();
  }

  const locale = resolveAppLocale({
    cookie: cookieValue,
    profile: prefs.profile,
    company: prefs.company,
    marketCountry: prefs.marketCountry,
  });
  const messages = await loadMessagesForLocale(locale);

  return {
    locale,
    messages,
    // Phase 17MENU / #503: prevent ENVIRONMENT_FALLBACK markup mismatches in CI + SSR.
    timeZone: "Europe/Oslo",
    onError(error) {
      if (error.code === "MISSING_MESSAGE") return;
      console.error(error);
    },
  };
});
