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
});
