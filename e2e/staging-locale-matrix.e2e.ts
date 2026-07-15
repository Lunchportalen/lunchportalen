// e2e/staging-locale-matrix.e2e.ts — 15 languages + 24 market locales on staging runtime.
import { test, expect } from "@playwright/test";

import { APP_LOCALES, SUPPORTED_MARKET_LOCALES } from "@/lib/i18n/localeRegistry";
import { LP_LOCALE_COOKIE } from "@/lib/i18n/middlewareLocale";
import { isStagingRuntimeBaseUrl } from "./helpers/staging-edge-bypass";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "";
const RUN = isStagingRuntimeBaseUrl(baseURL);

const MOJIBAKE = /\u00C3|\u00E2\u20AC|\u00C2 /;
const RAW_KEY = /\b[a-z]+\.[a-z]+\.[a-z_]+\b/;

function cookieDomain(): string {
  return new URL(baseURL).hostname;
}

async function withAppLocale(page: import("@playwright/test").Page, locale: string) {
  await page.context().addCookies([
    {
      name: LP_LOCALE_COOKIE,
      value: locale,
      domain: cookieDomain(),
      path: "/",
    },
  ]);
}

test.describe("staging locale matrix", () => {
  test.skip(!RUN, "staging runtime base URL required");

  for (const locale of APP_LOCALES) {
    test(`language ${locale} — login chrome`, async ({ page }) => {
      await withAppLocale(page, locale);
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      const body = await page.locator("body").innerText();
      expect(body).not.toMatch(MOJIBAKE);
      expect(body).not.toMatch(RAW_KEY);
      await expect(page.locator("#login-email")).toBeVisible();
    });
  }

  for (const row of SUPPORTED_MARKET_LOCALES) {
    test(`market locale ${row.locale} — login chrome`, async ({ page }) => {
      await withAppLocale(page, row.fallbackAppLocale);
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      const body = await page.locator("body").innerText();
      expect(body).not.toMatch(MOJIBAKE);
      expect(body).not.toMatch(RAW_KEY);
      expect(body.length).toBeGreaterThan(20);
    });
  }
});
