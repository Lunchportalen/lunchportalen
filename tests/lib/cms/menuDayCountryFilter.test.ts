import { describe, expect, it } from "vitest";

import {
  assertNoNorwayFallback,
  menuDayCountryFilterClause,
} from "@/lib/cms/menuDayCountryFilter";

describe("menuDayCountryFilter", () => {
  it("allows legacy missing countryCode only for NO", () => {
    expect(menuDayCountryFilterClause("NO")).toContain('countryCode == "NO"');
    expect(menuDayCountryFilterClause("SE")).toBe('&& countryCode == "SE"');
  });

  it("blocks Norway content for other countries", () => {
    expect(() =>
      assertNoNorwayFallback({ requestedCountry: "SE", documentCountry: "NO" }),
    ).toThrow(/CROSS_COUNTRY_MENU_LEAK/);
    expect(() =>
      assertNoNorwayFallback({ requestedCountry: "SE", documentCountry: "SE" }),
    ).not.toThrow();
  });
});
