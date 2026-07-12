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

describe("marketLocaleRuntime (21-language runtime resolution)", () => {
  it("binds exactly the 21 canonical market locales", () => {
    expect(MARKET_LOCALE_RUNTIME).toHaveLength(21);
    expect(MARKET_LOCALE_RUNTIME.map((r) => r.locale)).toEqual(
      SUPPORTED_MARKET_LOCALES.map((e) => e.locale),
    );
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

  it("regional variants share base language but keep market Intl locale", () => {
    // English regional variants
    for (const loc of ["en-GB", "en-US", "en-CA", "en-IE", "en-AU", "en-SG"]) {
      expect(baseLanguageForMarketLocale(loc)).toBe("en");
      expect(intlLocaleForMarketLocale(loc)).toBe(loc);
    }
    // German regional variants
    for (const loc of ["de-DE", "de-AT", "de-CH"]) {
      expect(baseLanguageForMarketLocale(loc)).toBe("de");
      expect(intlLocaleForMarketLocale(loc)).toBe(loc);
    }
    // French regional variants
    for (const loc of ["fr-FR", "fr-BE", "fr-CH", "fr-LU"]) {
      expect(baseLanguageForMarketLocale(loc)).toBe("fr");
      expect(intlLocaleForMarketLocale(loc)).toBe(loc);
    }
  });

  it("Intl formatting differs per market even when base language is shared", () => {
    const gb = new Intl.NumberFormat(intlLocaleForMarketLocale("en-GB")!, { style: "currency", currency: "GBP" }).format(1234.5);
    const us = new Intl.NumberFormat(intlLocaleForMarketLocale("en-US")!, { style: "currency", currency: "USD" }).format(1234.5);
    expect(gb).toContain("£");
    expect(us).toContain("$");
  });

  it("rejects unknown locales (fail-closed)", () => {
    expect(isMarketLocaleCode("xx-YY")).toBe(false);
    expect(resolveMarketLocaleRuntime("pt-PT")).toBeNull();
    expect(baseLanguageForMarketLocale("")).toBeNull();
  });

  it("all 10 base languages are represented across the 21 locales", () => {
    const used = new Set(MARKET_LOCALE_RUNTIME.map((r) => r.baseLanguage));
    // nb, sv, da, fi, en, de, fr, es, it, nl
    expect(used.size).toBe(10);
    expect([...used].sort()).toEqual(["da", "de", "en", "es", "fi", "fr", "it", "nb", "nl", "sv"]);
  });
});
