/**
 * 21-COUNTRY FULL MARKET FLOW — one flow per canonical country.
 *
 * For every country: market registry → selectable language(s) → correct locale
 * resolution → menu profile (with warm-dish bank) → order/cancel/production/
 * delivery/economics/invoice/email surfaces resolve in the market's languages
 * with market-correct Intl formatting — and language never changes market
 * identity, currency or tenant scoping inputs.
 *
 * Requirements: 21/21 PASS, 0 skipped, 0 country duplicates, 0 incorrect
 * market-locale mapping, 0 unexpected language fallback.
 */
import { describe, expect, it } from "vitest";

import {
  SUPPORTED_MARKETS,
  resolveMarketLocale,
  type MarketCountry,
} from "@/lib/markets/supportedMarkets";
import { SUPPORTED_MARKET_LOCALES } from "@/lib/i18n/localeRegistry";
import { baseLanguageForMarketLocale, intlLocaleForMarketLocale } from "@/lib/i18n/marketLocaleRuntime";
import { defaultAppLocaleForCountry, resolveAppLocale } from "@/lib/i18n/resolveAppLocale";
import { loadMessagesForLocale } from "@/lib/i18n/messages";
import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";
import { assertMenuProfile } from "@/lib/menu-profile/registry";
import { getWarmDishBankSeedsForProfile } from "@/lib/menu-profile/warmDishBankSeeds";
import { providerCountryCodeToMarket } from "@/lib/menu-profile/providerMenuProfileResolver";
import { employeeInviteCopy, passwordResetCopy } from "@/lib/email/i18n/emailCopy";
import { getTierDisplayLabel } from "@/lib/tiers/displayLabels";
import type { AppLocale } from "@/lib/i18n/localeRegistry";

/** Message keys that must resolve (non-raw, non-empty) on every mandatory surface. */
const SURFACE_KEYS = [
  // menu / week plan
  "provider.menu.week.plannerTitle",
  "provider.menu.week.plannerLead",
  // ordering + cancellation (order status flow includes cancelled)
  "provider.orders.page.heading",
  "provider.orders.status.received",
  "provider.orders.status.cancelled",
  // production
  "provider.orders.actions.startProduction",
  "provider.orders.status.inProduction",
  // delivery
  "provider.orders.actions.markDelivered",
  "provider.orders.status.delivered",
  // economics / billing / invoice
  "provider.billing.page.heading",
  "provider.billing.invoice.total",
  "provider.billing.invoice.vat",
  // validation / errors / common chrome
  "common.loading",
  "provider.orders.errors.updateFailed",
] as const;

function getAtPath(node: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, node);
}

const messageCache = new Map<string, Record<string, unknown>>();
async function messagesFor(lang: AppLocale): Promise<Record<string, unknown>> {
  if (!messageCache.has(lang)) {
    messageCache.set(lang, (await loadMessagesForLocale(lang)) as Record<string, unknown>);
  }
  return messageCache.get(lang)!;
}

describe("21-country full market flow (one per country)", () => {
  it("has exactly 21 markets with zero country duplicates", () => {
    expect(SUPPORTED_MARKETS).toHaveLength(21);
    expect(new Set(SUPPORTED_MARKETS.map((m) => m.countryCode)).size).toBe(21);
  });

  describe.each(SUPPORTED_MARKETS.map((m) => [m.countryCode, m] as const))(
    "market %s",
    (countryCode, market: MarketCountry) => {
      it("provider → company scoping model: ISO country resolves to exactly this market", () => {
        // Provider settings store the ISO country; it must resolve to this market's
        // menu-profile market code (tenant scoping input is the country, never the language).
        const menuMarket = providerCountryCodeToMarket(countryCode);
        expect(menuMarket).toBe(countryCode);
        const defaults = getMarketDefaults(menuMarket!);
        expect(defaults.defaultCurrency).toBe(market.currency);
      });

      it("selectable languages resolve to correct locales without changing market identity", () => {
        for (const locale of market.supportedLocales) {
          const ml = resolveMarketLocale(locale);
          expect(ml, `${locale} must be a market locale`).not.toBeNull();
          // Correct market-locale mapping: locale binds back to this country only.
          expect(ml!.countryCode).toBe(countryCode);
          // The locale-level registry row agrees on market identity and currency.
          const row = SUPPORTED_MARKET_LOCALES.find((e) => e.locale === locale)!;
          expect(row.countryCode).toBe(countryCode);
          expect(row.currency).toBe(market.currency);
        }
      });

      it("locale chain: market default UI language wins when user/company set nothing", () => {
        const resolved = resolveAppLocale({ marketCountry: countryCode });
        expect(resolved).toBe(defaultAppLocaleForCountry(countryCode));
        // Explicit user choice (any supported language) wins — and changes ONLY the language.
        for (const lang of market.supportedLanguages) {
          expect(resolveAppLocale({ cookie: lang, marketCountry: countryCode })).toBe(lang);
        }
      });

      it("menu: market menu profile resolves with a non-empty warm dish bank", () => {
        const profile = assertMenuProfile(market.menuProfileId);
        expect(profile.packageModel.basis.categoryKeys.length).toBeGreaterThan(0);
        expect(getWarmDishBankSeedsForProfile(profile.id).length).toBeGreaterThanOrEqual(5);
      });

      it("ordering→cancellation→production→delivery→economics surfaces resolve in every market language (no fallback)", async () => {
        for (const locale of market.supportedLocales) {
          const base = baseLanguageForMarketLocale(locale);
          expect(base, `${locale} base language`).not.toBeNull();
          const messages = await messagesFor(base as AppLocale);
          for (const key of SURFACE_KEYS) {
            const value = getAtPath(messages, key);
            expect(typeof value, `${locale} → ${base} → ${key}`).toBe("string");
            expect(String(value).trim().length, `${locale} ${key} empty`).toBeGreaterThan(0);
            expect(value, `${locale} ${key} raw-key leak`).not.toBe(key);
          }
          // Tier labels resolve for the market locale (order/invoice surfaces).
          expect(getTierDisplayLabel("BASIS", locale)).not.toBe("BASIS");
          expect(getTierDisplayLabel("ENTERPRISE", locale)).toBe("Enterprise");
        }
      });

      it("economics/invoice: market-correct Intl currency, number, date and percent formatting", () => {
        for (const locale of market.supportedLocales) {
          const intl = intlLocaleForMarketLocale(locale);
          expect(intl).toBe(locale);
          const currency = new Intl.NumberFormat(intl!, { style: "currency", currency: market.currency }).format(1234.56);
          expect(currency.length).toBeGreaterThan(0);
          // Currency amount must contain locale-formatted digits.
          expect(currency).toMatch(/\d/);
          const percent = new Intl.NumberFormat(intl!, { style: "percent" }).format(0.25);
          expect(percent).toContain("%");
          const date = new Intl.DateTimeFormat(intl!, { dateStyle: "long" }).format(new Date("2026-06-16T12:00:00Z"));
          expect(date).toMatch(/2026/);
        }
        // Timezone strategy is actionable: fixed markets have a valid IANA zone.
        if (market.timezoneStrategy === "fixed") {
          expect(() => new Intl.DateTimeFormat("en", { timeZone: market.defaultTimezone! })).not.toThrow();
        } else {
          expect(market.defaultTimezone).toBeNull();
        }
      });

      it("emails: invite + password reset copy resolves for every market language", () => {
        for (const lang of market.supportedLanguages) {
          const invite = employeeInviteCopy(lang);
          expect(invite.subject("Acme").length).toBeGreaterThan(0);
          expect(invite.cta.length).toBeGreaterThan(0);
          const reset = passwordResetCopy(lang);
          expect(reset.subject.length).toBeGreaterThan(0);
          expect(reset.validityNote).toMatch(/30/);
        }
      });

      it("invoice locale belongs to this market (never another tenant/market)", () => {
        expect(market.supportedLocales).toContain(market.invoiceLocale);
        expect(resolveMarketLocale(market.invoiceLocale)!.countryCode).toBe(countryCode);
      });
    },
  );
});
