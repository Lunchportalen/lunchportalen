import { describe, expect, test } from "vitest";
import { cmsPlanNameForAgreementTier } from "@/lib/cms/getProductPlan";

describe("cmsPlanNameForAgreementTier (MP5: 3-tier)", () => {
  test("maps each agreement tier to Sanity productPlan.name", () => {
    expect(cmsPlanNameForAgreementTier("BASIS")).toBe("basis");
    expect(cmsPlanNameForAgreementTier("LUXUS")).toBe("luxus");
    expect(cmsPlanNameForAgreementTier("ENTERPRISE")).toBe("enterprise");
  });
});
