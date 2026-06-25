import { describe, expect, it } from "vitest";

import {
  APP_LOCALES,
  DEFAULT_APP_LOCALE,
  getLocaleLabel,
  htmlLangForAppLocale,
  intlLocaleForAppLocale,
  isAppLocale,
  parseAppLocale,
} from "@/lib/i18n/localeRegistry";

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
});
