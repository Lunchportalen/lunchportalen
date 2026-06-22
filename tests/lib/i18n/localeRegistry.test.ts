import { describe, expect, it } from "vitest";

import {
  APP_LOCALES,
  DEFAULT_APP_LOCALE,
  getLocaleLabel,
  htmlLangForAppLocale,
  intlLocaleForAppLocale,
  isAppLocale,
  isProfilePersistLocale,
  parseAppLocale,
  PROFILE_PERSIST_LOCALES,
} from "@/lib/i18n/localeRegistry";

describe("localeRegistry", () => {
  it("contains all eight app locales with nb as default", () => {
    expect(APP_LOCALES).toEqual(["nb", "en", "sv", "da", "fi", "de", "fr", "es"]);
    expect(DEFAULT_APP_LOCALE).toBe("nb");
    expect(APP_LOCALES).toHaveLength(8);
  });

  it("parseAppLocale accepts nb/en/sv/da/fi/de/fr/es", () => {
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
  });

  it("getLocaleLabel returns native labels", () => {
    expect(getLocaleLabel("nb")).toBe("Norsk");
    expect(getLocaleLabel("en")).toBe("English");
    expect(getLocaleLabel("sv")).toBe("Svenska");
    expect(getLocaleLabel("fi")).toBe("Suomi");
    expect(getLocaleLabel("fr")).toBe("Français");
  });

  it("profile persist allowlist is nb/en only until DB migration", () => {
    expect(PROFILE_PERSIST_LOCALES).toEqual(["nb", "en"]);
    expect(isProfilePersistLocale("nb")).toBe(true);
    expect(isProfilePersistLocale("en")).toBe(true);
    expect(isProfilePersistLocale("sv")).toBe(false);
    expect(isProfilePersistLocale("de")).toBe(false);
  });
});
