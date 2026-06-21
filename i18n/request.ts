import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import { LP_LOCALE_COOKIE, parseAppLocale } from "@/lib/i18n/middlewareLocale";
import { loadProfilePreferredLocaleForRequest } from "@/lib/i18n/profileLocale";
import { resolveAppLocale } from "@/lib/i18n/resolveAppLocale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieValue = cookieStore.get(LP_LOCALE_COOKIE)?.value ?? headerStore.get("x-lp-locale");

  let profileLocale: string | null = null;
  if (!parseAppLocale(cookieValue)) {
    profileLocale = (await loadProfilePreferredLocaleForRequest()) ?? null;
  }

  const locale = resolveAppLocale({ cookie: cookieValue, profile: profileLocale });
  const messages = await loadMessagesForLocale(locale);

  return {
    locale,
    messages,
    onError(error) {
      if (error.code === "MISSING_MESSAGE") return;
      console.error(error);
    },
  };
});
