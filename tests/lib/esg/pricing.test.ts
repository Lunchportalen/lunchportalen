import { describe, expect, test } from "vitest";

import { operationalPlanTier, priceForTierNok, resolveMealPriceNok } from "@/lib/esg/pricing";

describe("operationalPlanTier (MP3 / Patch 2.1)", () => {
  test("ENTERPRISE maps to LUXUS", () => {
    expect(operationalPlanTier("ENTERPRISE")).toBe("LUXUS");
  });

  test("BASIS and LUXUS unchanged", () => {
    expect(operationalPlanTier("BASIS")).toBe("BASIS");
    expect(operationalPlanTier("LUXUS")).toBe("LUXUS");
  });
});

describe("priceForTierNok", () => {
  test("ENTERPRISE uses LUXUS list price (not separate 170 tier)", () => {
    expect(priceForTierNok("ENTERPRISE")).toBe(130);
    expect(priceForTierNok("LUXUS")).toBe(130);
    expect(priceForTierNok("BASIS")).toBe(90);
  });

  test("agreement override wins", () => {
    expect(resolveMealPriceNok({ tier: "ENTERPRISE", agreementPriceNok: 199 })).toBe(199);
  });
});
