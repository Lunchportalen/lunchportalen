/**
 * FAIL-CLOSED GATE — 21 canonical country markets.
 *
 * Locks the corrected market model:
 *   - exactly 21 markets = 21 unique countries (19 EU + US + CA)
 *   - AU / SG / LU absent from launch scope
 *   - BE / CH / CA each count once (multi-locale, single market)
 *   - language never changes market identity, currency or tax
 */
import { describe, expect, it } from "vitest";

import {
  ENABLED_MARKETS,
  EUROPEAN_MARKETS,
  MARKET_LOCALES,
  NORTH_AMERICAN_MARKETS,
  RETIRED_LAUNCH_COUNTRIES,
  RETIRED_LAUNCH_LOCALES,
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_MARKETS,
  countryForLocale,
  getMarketCountry,
  isSupportedCountry,
  languageForLocale,
  resolveMarketLocale,
} from "@/lib/markets/supportedMarkets";
import { SUPPORTED_MARKET_LOCALES } from "@/lib/i18n/localeRegistry";
import {
  MARKET_LOCALE_RUNTIME,
  RUNTIME_BASE_LANGUAGES,
} from "@/lib/i18n/marketLocaleRuntime";

const REQUIRED_COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
] as const;

describe("21 canonical country markets", () => {
  it("has exactly 21 markets and 21 unique countries", () => {
    expect(SUPPORTED_MARKETS).toHaveLength(21);
    expect(new Set(SUPPORTED_MARKETS.map((m) => m.countryCode)).size).toBe(21);
    expect(SUPPORTED_COUNTRY_CODES).toHaveLength(21);
  });

  it("has 19 European and 2 North American markets", () => {
    expect(EUROPEAN_MARKETS).toHaveLength(19);
    expect(NORTH_AMERICAN_MARKETS).toHaveLength(2);
    expect(NORTH_AMERICAN_MARKETS.map((m) => m.countryCode).sort()).toEqual(["CA", "US"]);
  });

  it("contains every required country and nothing else", () => {
    const codes = SUPPORTED_MARKETS.map((m) => m.countryCode).sort();
    expect(codes).toEqual([...REQUIRED_COUNTRIES].sort());
  });

  it("USA and Canada are present", () => {
    expect(getMarketCountry("US")).not.toBeNull();
    expect(getMarketCountry("CA")).not.toBeNull();
  });

  it("Australia, Singapore and Luxembourg are absent from launch scope", () => {
    for (const cc of ["AU", "SG", "LU"]) {
      expect(isSupportedCountry(cc)).toBe(false);
      expect(getMarketCountry(cc)).toBeNull();
    }
    expect([...RETIRED_LAUNCH_COUNTRIES].sort()).toEqual(["AU", "LU", "SG"]);
    expect([...RETIRED_LAUNCH_LOCALES].sort()).toEqual(["en-AU", "en-SG", "fr-LU"]);
  });

  it("Belgium, Switzerland and Canada each have exactly one market row", () => {
    for (const cc of ["BE", "CH", "CA"]) {
      expect(SUPPORTED_MARKETS.filter((m) => m.countryCode === cc)).toHaveLength(1);
    }
  });

  it("every market has currency, timezone strategy, tax strategy, invoice locale and menu profile", () => {
    for (const m of SUPPORTED_MARKETS) {
      expect(m.currency).toMatch(/^[A-Z]{3}$/);
      expect(["fixed", "provider_required"]).toContain(m.timezoneStrategy);
      if (m.timezoneStrategy === "fixed") {
        expect(m.defaultTimezone).toBeTruthy();
      } else {
        expect(m.defaultTimezone).toBeNull();
      }
      expect(["vat", "sales_tax", "gst"]).toContain(m.taxStrategy);
      expect(m.invoiceLocale).toBeTruthy();
      expect(m.menuProfileId).toBeTruthy();
      expect(m.phoneCountryCode).toMatch(/^\+\d+$/);
      expect(m.enabled).toBe(true);
    }
    expect(ENABLED_MARKETS).toHaveLength(21);
  });
});

describe("multi-language markets", () => {
  it("Canada supports en-CA and fr-CA", () => {
    const ca = getMarketCountry("CA")!;
    expect([...ca.supportedLocales].sort()).toEqual(["en-CA", "fr-CA"]);
    expect([...ca.supportedLanguages].sort()).toEqual(["en", "fr"]);
  });

  it("Belgium supports nl-BE and fr-BE", () => {
    const be = getMarketCountry("BE")!;
    expect([...be.supportedLocales].sort()).toEqual(["fr-BE", "nl-BE"]);
    expect(be.supportedLanguages).toContain("nl");
    expect(be.supportedLanguages).toContain("fr");
  });

  it("Switzerland supports de-CH and fr-CH (Italian available as UI language)", () => {
    const ch = getMarketCountry("CH")!;
    expect([...ch.supportedLocales].sort()).toEqual(["de-CH", "fr-CH"]);
    expect(ch.supportedLanguages).toContain("de");
    expect(ch.supportedLanguages).toContain("fr");
    // Existing product requirement check: it-CH is not a market locale, but Italian
    // remains selectable as a UI language for Swiss users.
    expect(ch.supportedLanguages).toContain("it");
  });

  it("USA uses en-US, Great Britain uses en-GB", () => {
    expect(getMarketCountry("US")!.defaultLocale).toBe("en-US");
    expect(getMarketCountry("GB")!.defaultLocale).toBe("en-GB");
  });
});

describe("language / market separation", () => {
  it("every market locale maps to exactly one supported country and one base language", () => {
    for (const ml of MARKET_LOCALES) {
      expect(isSupportedCountry(ml.countryCode)).toBe(true);
      expect(SUPPORTED_LANGUAGES).toContain(ml.language);
      expect(countryForLocale(ml.locale)).toBe(ml.countryCode);
      expect(languageForLocale(ml.locale)).toBe(ml.language);
    }
  });

  it("locale never changes market identity: all locales of a market share its currency and tax country", () => {
    for (const m of SUPPORTED_MARKETS) {
      for (const loc of m.supportedLocales) {
        const ml = resolveMarketLocale(loc)!;
        expect(ml.countryCode).toBe(m.countryCode);
        const registryEntry = SUPPORTED_MARKET_LOCALES.find((e) => e.locale === loc);
        if (registryEntry) {
          expect(registryEntry.countryCode).toBe(m.countryCode);
          expect(registryEntry.currency).toBe(m.currency);
        }
      }
    }
  });

  it("supported languages are the 15 base languages and runtime bindings agree", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(15);
    expect([...RUNTIME_BASE_LANGUAGES].sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });

  it("legacy locale-level registry spans exactly the 21 countries (no AU/SG/LU)", () => {
    const countries = new Set(SUPPORTED_MARKET_LOCALES.map((e) => e.countryCode));
    expect([...countries].sort()).toEqual([...REQUIRED_COUNTRIES].sort());
    for (const e of SUPPORTED_MARKET_LOCALES) {
      expect(["AU", "SG", "LU"]).not.toContain(e.countryCode);
    }
  });

  it("runtime market locales carry market-correct Intl locales", () => {
    for (const r of MARKET_LOCALE_RUNTIME) {
      expect(r.intlLocale).toBe(r.locale);
      const country = countryForLocale(r.locale);
      expect(country).not.toBeNull();
    }
  });
});
