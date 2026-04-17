import { describe, expect, test } from "vitest";
import { validateMealContractPayload } from "@/lib/server/agreements/mealContract";
import type { CmsProductPlan } from "@/lib/cms/types";

const basisPlan: CmsProductPlan = {
  name: "basis",
  price: 90,
  allowedMeals: ["salatbar", "paasmurt", "varmmat"],
  rules: { allowDailyVariation: false },
};

const luxusPlan: CmsProductPlan = {
  name: "luxus",
  price: 130,
  allowedMeals: ["salatbar", "paasmurt", "varmmat", "sushi", "pokebowl", "thaimat"],
  rules: { allowDailyVariation: true },
};

describe("mealContract validation", () => {
  test("basis: rejects menu_per_day", () => {
    const r = validateMealContractPayload({
      rpcTier: "BASIS",
      deliveryDays: ["mon"],
      payload: {
        plan: "basis",
        fixed_meal_type: "varmmat",
        menu_per_day: { mon: "sushi" },
      },
      cmsBasis: basisPlan,
      cmsLuxus: luxusPlan,
    });
    expect(r.ok).toBe(false);
  });

  test("basis: accepts fixed meal in CMS allowlist", () => {
    const r = validateMealContractPayload({
      rpcTier: "BASIS",
      deliveryDays: ["mon", "tue"],
      payload: { plan: "basis", fixed_meal_type: "varmmat" },
      cmsBasis: basisPlan,
      cmsLuxus: luxusPlan,
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.normalized.plan === "basis") {
      expect(r.normalized.fixed_meal_type).toBe("varmmat");
    }
  });

  test("luxus: requires each delivery day in menu_per_day", () => {
    const r = validateMealContractPayload({
      rpcTier: "LUXUS",
      deliveryDays: ["mon", "tue"],
      payload: {
        plan: "luxus",
        menu_per_day: { mon: "sushi" },
      },
      cmsBasis: basisPlan,
      cmsLuxus: luxusPlan,
    });
    expect(r.ok).toBe(false);
  });

  test("luxus: accepts full menu_per_day", () => {
    const r = validateMealContractPayload({
      rpcTier: "LUXUS",
      deliveryDays: ["mon", "tue"],
      payload: {
        plan: "luxus",
        menu_per_day: { mon: "sushi", tue: "thaimat" },
      },
      cmsBasis: basisPlan,
      cmsLuxus: luxusPlan,
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.normalized.plan === "luxus") {
      expect(r.normalized.menu_per_day.mon).toBe("sushi");
    }
  });
});
