import { describe, expect, it } from "vitest";

import { resolveAppLocale } from "@/lib/i18n/resolveAppLocale";

describe("resolveAppLocale", () => {
  it("prefers cookie over profile and default", () => {
    expect(resolveAppLocale({ cookie: "en", profile: "nb" })).toBe("en");
    expect(resolveAppLocale({ cookie: "nb", profile: "en" })).toBe("nb");
  });

  it("falls back to profile when cookie is missing or invalid", () => {
    expect(resolveAppLocale({ cookie: null, profile: "en" })).toBe("en");
    expect(resolveAppLocale({ cookie: "xx", profile: "en" })).toBe("en");
  });

  it("defaults to nb when cookie and profile are absent or invalid", () => {
    expect(resolveAppLocale({})).toBe("nb");
    expect(resolveAppLocale({ cookie: "invalid", profile: "also-invalid" })).toBe("nb");
    expect(resolveAppLocale({ cookie: null, profile: null })).toBe("nb");
  });

  it("accepts new registry locales from cookie", () => {
    expect(resolveAppLocale({ cookie: "sv" })).toBe("sv");
    expect(resolveAppLocale({ cookie: "de", profile: "nb" })).toBe("de");
    expect(resolveAppLocale({ cookie: null, profile: "es" })).toBe("es");
  });

  // Fase E1: full chain user → company → market → nb
  it("falls back to company default when cookie and profile are missing", () => {
    expect(resolveAppLocale({ company: "sv" })).toBe("sv");
    expect(resolveAppLocale({ cookie: "xx", profile: null, company: "da" })).toBe("da");
  });

  it("profile beats company default; cookie beats both", () => {
    expect(resolveAppLocale({ profile: "en", company: "sv" })).toBe("en");
    expect(resolveAppLocale({ cookie: "fi", profile: "en", company: "sv" })).toBe("fi");
  });

  it("falls back to market default language for known countries", () => {
    expect(resolveAppLocale({ marketCountry: "SE" })).toBe("sv");
    expect(resolveAppLocale({ marketCountry: "DK" })).toBe("da");
    expect(resolveAppLocale({ marketCountry: "DE" })).toBe("de");
    expect(resolveAppLocale({ marketCountry: "no" })).toBe("nb");
  });

  it("company default beats market default", () => {
    expect(resolveAppLocale({ company: "en", marketCountry: "SE" })).toBe("en");
  });

  it("invalid company locale and unknown market fall through to nb (fail-closed)", () => {
    expect(resolveAppLocale({ company: "not-a-locale", marketCountry: "ZZ" })).toBe("nb");
  });

  it("defaultAppLocaleForCountry returns null for unknown countries", async () => {
    const { defaultAppLocaleForCountry } = await import("@/lib/i18n/resolveAppLocale");
    expect(defaultAppLocaleForCountry("ZZ")).toBeNull();
    expect(defaultAppLocaleForCountry("")).toBeNull();
    expect(defaultAppLocaleForCountry("SE")).toBe("sv");
  });
});
