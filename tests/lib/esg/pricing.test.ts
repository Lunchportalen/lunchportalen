import { describe, expect, test } from "vitest";
import { priceForTierNok, resolveMealPriceNok } from "@/lib/esg/pricing";

describe("priceForTierNok (MP5: 3-tier)", () => {
  test("BASIS = 90, LUXUS = 130, ENTERPRISE = 170", () => {
    expect(priceForTierNok("BASIS")).toBe(90);
    expect(priceForTierNok("LUXUS")).toBe(130);
    expect(priceForTierNok("ENTERPRISE")).toBe(170);
  });

  test("resolveMealPriceNok respects agreement override", () => {
    expect(resolveMealPriceNok({ tier: "ENTERPRISE", agreementPriceNok: 199 })).toBe(199);
    expect(resolveMealPriceNok({ tier: "ENTERPRISE", agreementPriceNok: null })).toBe(170);
  });
});
