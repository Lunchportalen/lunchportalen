import { describe, expect, it } from "vitest";

import {
  MARKET_LOCALE_RUNTIME,
  RUNTIME_BASE_LANGUAGES,
  baseLanguageForMarketLocale,
  intlLocaleForMarketLocale,
  isMarketLocaleCode,
  resolveMarketLocaleRuntime,
} from "@/lib/i18n/marketLocaleRuntime";
import { SUPPORTED_MARKET_LOCALES } from "@/lib/i18n/localeRegistry";

describe("marketLocaleRuntime (21-country market locale runtime resolution)", () => {
  it("binds exactly the canonical market locales (24 locales, 21 countries)", () => {
    expect(MARKET_LOCALE_RUNTIME).toHaveLength(24);
    expect(MARKET_LOCALE_RUNTIME.map((r) => r.locale)).toEqual(
      SUPPORTED_MARKET_LOCALES.map((e) => e.locale),
    );
    expect(new Set(SUPPORTED_MARKET_LOCALES.map((e) => e.countryCode)).size).toBe(21);
  });

  it("every market locale resolves to a base language and an Intl locale", () => {
    for (const entry of SUPPORTED_MARKET_LOCALES) {
      const rt = resolveMarketLocaleRuntime(entry.locale);
      expect(rt, entry.locale).not.toBeNull();
      expect(RUNTIME_BASE_LANGUAGES).toContain(rt!.baseLanguage);
      expect(rt!.intlLocale).toBe(entry.locale);
    }
  });

  it("Dutch markets bind to nl (not English fallback)", () => {
    expect(baseLanguageForMarketLocale("nl-NL")).toBe("nl");
    expect(baseLanguageForMarketLocale("nl-BE")).toBe("nl");
  });

  it("new country markets bind to their own base languages", () => {
    expect(baseLanguageForMarketLocale("pl-PL")).toBe("pl");
    expect(baseLanguageForMarketLocale("ro-RO")).toBe("ro");
    expect(baseLanguageForMarketLocale("cs-CZ")).toBe("cs");
    expect(baseLanguageForMarketLocale("pt-PT")).toBe("pt");
    expect(baseLanguageForMarketLocale("el-GR")).toBe("el");
  });

  it("regional variants share base language but keep market Intl locale", () => {
    for (const loc of ["en-GB", "en-US", "en-CA", "en-IE"]) {
      expect(baseLanguageForMarketLocale(loc)).toBe("en");
      expect(intlLocaleForMarketLocale(loc)).toBe(loc);
    }
    for (const loc of ["de-DE", "de-AT", "de-CH"]) {
      expect(baseLanguageForMarketLocale(loc)).toBe("de");
      expect(intlLocaleForMarketLocale(loc)).toBe(loc);
    }
    for (const loc of ["fr-FR", "fr-BE", "fr-CH", "fr-CA"]) {
      expect(baseLanguageForMarketLocale(loc)).toBe("fr");
      expect(intlLocaleForMarketLocale(loc)).toBe(loc);
    }
  });

  it("Intl formatting differs per market even when base language is shared", () => {
    const gb = new Intl.NumberFormat(intlLocaleForMarketLocale("en-GB")!, { style: "currency", currency: "GBP" }).format(1234.5);
    const us = new Intl.NumberFormat(intlLocaleForMarketLocale("en-US")!, { style: "currency", currency: "USD" }).format(1234.5);
    const caFr = new Intl.NumberFormat(intlLocaleForMarketLocale("fr-CA")!, { style: "currency", currency: "CAD" }).format(1234.5);
    expect(gb).toContain("£");
    expect(us).toContain("$");
    expect(caFr).toContain("$");
  });

  it("rejects unknown and retired locales (fail-closed)", () => {
    expect(isMarketLocaleCode("xx-YY")).toBe(false);
    expect(resolveMarketLocaleRuntime("en-AU")).toBeNull();
    expect(resolveMarketLocaleRuntime("en-SG")).toBeNull();
    expect(resolveMarketLocaleRuntime("fr-LU")).toBeNull();
    expect(baseLanguageForMarketLocale("")).toBeNull();
  });

  it("all 15 base languages are represented across the market locales", () => {
    const used = new Set(MARKET_LOCALE_RUNTIME.map((r) => r.baseLanguage));
    expect(used.size).toBe(15);
    expect([...used].sort()).toEqual(
      ["cs", "da", "de", "el", "en", "es", "fi", "fr", "it", "nb", "nl", "pl", "pt", "ro", "sv"],
    );
  });
});
