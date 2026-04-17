import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/cms/getProductPlan", () => ({
  getProductPlan: async (name: "basis" | "luxus") => ({
    name,
    price: name === "basis" ? 90 : 130,
    allowedMeals: ["standard", "vegetar", "glutenfri"],
    rules: { allowDailyVariation: name === "luxus" },
  }),
}));

import { validateLedgerAgreementForApproval } from "@/lib/server/agreements/validateLedgerAgreementForApproval";

describe("validateLedgerAgreementForApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts basis with aligned meal_contract", async () => {
    const res = await validateLedgerAgreementForApproval({
      tier: "BASIS",
      delivery_days: ["mon", "tue"],
      price_per_employee: 90,
      agreement_json: {
        meal_contract: {
          plan: "basis",
          delivery_days: ["mon", "tue"],
          fixed_meal_type: "standard",
        },
      },
    });
    expect(res.ok).toBe(true);
  });

  it("rejects when delivery days invalid", async () => {
    const res = await validateLedgerAgreementForApproval({
      tier: "BASIS",
      delivery_days: ["sat"],
      price_per_employee: 90,
      agreement_json: {
        meal_contract: {
          plan: "basis",
          delivery_days: ["mon"],
          fixed_meal_type: "standard",
        },
      },
    });
    expect(res.ok).toBe(false);
  });
});
