import { defineRouting } from "next-intl/routing";

import { APP_LOCALES, DEFAULT_APP_LOCALE } from "@/lib/i18n/middlewareLocale";

export const routing = defineRouting({
  locales: [...APP_LOCALES],
  defaultLocale: DEFAULT_APP_LOCALE,
  localePrefix: "never",
});
