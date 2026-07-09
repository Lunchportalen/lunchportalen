import { describe, expect, it } from "vitest";

import {
  APP_LOCALES,
  DEFAULT_APP_LOCALE,
  getLocaleLabel,
  htmlLangForAppLocale,
  intlLocaleForAppLocale,
  isAppLocale,
  isSupportedMarketLocale,
  parseAppLocale,
  SUPPORTED_MARKET_LOCALES,
} from "@/lib/i18n/localeRegistry";
import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";
import { isSupportedMenuProfile } from "@/lib/menu-profile/registry";
import { getTierDisplayLabel } from "@/lib/tiers/displayLabels";

describe("localeRegistry", () => {
  it("contains all nine app locales in stable display order (nb first, then alphabetical)", () => {
    expect(APP_LOCALES).toEqual(["nb", "da", "de", "en", "es", "fr", "it", "fi", "sv"]);
    expect(DEFAULT_APP_LOCALE).toBe("nb");
    expect(APP_LOCALES).toHaveLength(9);
  });

  it("parseAppLocale accepts nb/en/sv/da/fi/de/fr/es/it", () => {
    for (const locale of APP_LOCALES) {
      expect(parseAppLocale(locale)).toBe(locale);
      expect(parseAppLocale(locale.toUpperCase())).toBe(locale);
    }
  });

  it("parseAppLocale rejects invalid values", () => {
    expect(parseAppLocale("xx")).toBeNull();
    expect(parseAppLocale("no")).toBeNull();
    expect(parseAppLocale("")).toBeNull();
    expect(parseAppLocale(null)).toBeNull();
  });

  it("isAppLocale mirrors parseAppLocale", () => {
    expect(isAppLocale("sv")).toBe(true);
    expect(isAppLocale("pt")).toBe(false);
  });

  it("maps htmlLang and intl locale tags", () => {
    expect(htmlLangForAppLocale("nb")).toBe("nb");
    expect(intlLocaleForAppLocale("nb")).toBe("nb-NO");
    expect(htmlLangForAppLocale("en")).toBe("en-GB");
    expect(intlLocaleForAppLocale("en")).toBe("en-GB");
    expect(htmlLangForAppLocale("sv")).toBe("sv-SE");
    expect(intlLocaleForAppLocale("sv")).toBe("sv-SE");
    expect(htmlLangForAppLocale("de")).toBe("de-DE");
    expect(intlLocaleForAppLocale("de")).toBe("de-DE");
    expect(htmlLangForAppLocale("es")).toBe("es-ES");
    expect(intlLocaleForAppLocale("es")).toBe("es-ES");
    expect(htmlLangForAppLocale("it")).toBe("it-IT");
    expect(intlLocaleForAppLocale("it")).toBe("it-IT");
  });

  it("getLocaleLabel returns native labels", () => {
    expect(getLocaleLabel("nb")).toBe("Norsk bokmål");
    expect(getLocaleLabel("en")).toBe("English");
    expect(getLocaleLabel("sv")).toBe("Svenska");
    expect(getLocaleLabel("fi")).toBe("Suomi");
    expect(getLocaleLabel("fr")).toBe("Français");
    expect(getLocaleLabel("it")).toBe("Italiano");
  });

  it("all app locales are valid for profile persistence after DB migration", () => {
    for (const locale of APP_LOCALES) {
      expect(isAppLocale(locale)).toBe(true);
      expect(parseAppLocale(locale)).toBe(locale);
    }
  });

  it("keeps routed UI app locales separate from 21 market locales", () => {
    expect(APP_LOCALES).toHaveLength(9);
    expect(SUPPORTED_MARKET_LOCALES).toHaveLength(21);
    expect(SUPPORTED_MARKET_LOCALES.map((entry) => entry.locale)).toEqual([
      "nb-NO",
      "sv-SE",
      "da-DK",
      "fi-FI",
      "en-GB",
      "de-DE",
      "fr-FR",
      "es-ES",
      "it-IT",
      "en-US",
      "en-CA",
      "nl-NL",
      "nl-BE",
      "fr-BE",
      "de-AT",
      "de-CH",
      "fr-CH",
      "en-IE",
      "fr-LU",
      "en-AU",
      "en-SG",
    ]);
  });

  it("has complete market locale identity for all 21 entries", () => {
    const codes = SUPPORTED_MARKET_LOCALES.map((entry) => entry.locale);
    expect(new Set(codes).size).toBe(codes.length);

    for (const entry of SUPPORTED_MARKET_LOCALES) {
      expect(isSupportedMarketLocale(entry.locale)).toBe(true);
      expect(entry.nativeLabel).toBeTruthy();
      expect(entry.norwegianLabel).toBeTruthy();
      expect(entry.englishLabel).toBeTruthy();
      expect(isAppLocale(entry.fallbackAppLocale)).toBe(true);
      expect(entry.market).toBeTruthy();
      expect(entry.countryCode).toBeTruthy();
      expect(entry.currency).toBeTruthy();
      expect(entry.timezone).toBeTruthy();
      expect(isSupportedMenuProfile(entry.menuProfileId)).toBe(true);
    }
  });

  it("aligns supported market locales with market defaults where they are the default locale", () => {
    for (const entry of SUPPORTED_MARKET_LOCALES) {
      const defaults = getMarketDefaults(entry.market as never);
      expect(defaults.defaultCurrency).toBe(entry.currency);
      if (defaults.defaultLocale === entry.locale) {
        expect(defaults.defaultMenuProfileId).toBe(entry.menuProfileId);
      }
    }
  });

  it("has tier display labels for every supported market locale", () => {
    for (const entry of SUPPORTED_MARKET_LOCALES) {
      expect(getTierDisplayLabel("BASIS", entry.locale)).toBeTruthy();
      expect(getTierDisplayLabel("LUXUS", entry.locale)).toBeTruthy();
      expect(getTierDisplayLabel("ENTERPRISE", entry.locale)).toBe("Enterprise");
    }
  });
});
