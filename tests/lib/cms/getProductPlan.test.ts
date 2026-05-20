import { describe, expect, test } from "vitest";

import { cmsPlanNameForAgreementTier } from "@/lib/cms/getProductPlan";

describe("cmsPlanNameForAgreementTier", () => {
  test("ENTERPRISE resolves to luxus CMS plan", () => {
    expect(cmsPlanNameForAgreementTier("ENTERPRISE")).toBe("luxus");
  });

  test("BASIS and LUXUS map to matching names", () => {
    expect(cmsPlanNameForAgreementTier("BASIS")).toBe("basis");
    expect(cmsPlanNameForAgreementTier("LUXUS")).toBe("luxus");
  });
});
