import { describe, expect, test } from "vitest";

import {
  buildContinuationPath,
  buildStartRedirectPath,
  hasGeographyParams,
  isValidCity,
  isValidPostalCode,
  normalizePostalCode,
  resolveStartIntent,
  shouldSkipStartRoleGate,
} from "@/lib/public/geographyParams";

describe("geographyParams", () => {
  test("normalizePostalCode strips non-digits", () => {
    expect(normalizePostalCode("01 50")).toBe("0150");
  });

  test("isValidPostalCode requires 4 digits", () => {
    expect(isValidPostalCode("0150")).toBe(true);
    expect(isValidPostalCode("150")).toBe(false);
  });

  test("isValidCity requires non-empty trimmed city", () => {
    expect(isValidCity("Oslo")).toBe(true);
    expect(isValidCity("   ")).toBe(false);
  });

  test("resolveStartIntent defaults to demo", () => {
    expect(resolveStartIntent(null)).toBe("demo");
    expect(resolveStartIntent("register")).toBe("register");
  });

  test("hasGeographyParams", () => {
    expect(hasGeographyParams("0150", "Oslo")).toBe(true);
    expect(hasGeographyParams("", "Oslo")).toBe(false);
  });

  test("buildContinuationPath", () => {
    expect(buildContinuationPath("demo", { postalCode: "0150", city: "Oslo", source: "hero" })).toBe(
      "/demo?postal_code=0150&city=Oslo&source=hero",
    );
    expect(buildContinuationPath("register", { postalCode: "0150", city: "Oslo", source: "hero" })).toContain(
      "/registrering?",
    );
  });

  test("buildStartRedirectPath", () => {
    expect(buildStartRedirectPath("demo", { source: "hero" })).toBe("/start?intent=demo&source=hero");
  });

  test("shouldSkipStartRoleGate", () => {
    expect(shouldSkipStartRoleGate(null, null, null)).toBe(false);
    expect(shouldSkipStartRoleGate(undefined, "", "")).toBe(false);
    expect(shouldSkipStartRoleGate("demo", null, null)).toBe(true);
    expect(shouldSkipStartRoleGate("register", null, null)).toBe(true);
    expect(shouldSkipStartRoleGate(null, "0150", "Oslo")).toBe(true);
    expect(shouldSkipStartRoleGate("hero", null, null)).toBe(false);
  });
});
