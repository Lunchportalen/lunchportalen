import { describe, expect, it } from "vitest";

import {
  assertCommonWarmDishAcrossPackages,
  assertGenerationUsesApprovedBank,
} from "@/lib/menu-publish/warmDishGenerationAudit";

describe("warmDishGenerationAudit", () => {
  it("rejects dishes outside approved bank", () => {
    expect(() =>
      assertGenerationUsesApprovedBank({
        selectedDishKeys: ["no-warm-01", "ghost"],
        approvedBankKeys: new Set(["no-warm-01"]),
      }),
    ).toThrow(/GENERATION_WITHOUT_APPROVED_BANK_ITEM/);
  });

  it("enforces one common warm dish per provider day across packages", () => {
    expect(() =>
      assertCommonWarmDishAcrossPackages([
        { date: "2026-07-20", dish_key: "a", package_keys: ["BASIS"] },
        { date: "2026-07-20", dish_key: "b", package_keys: ["LUXUS"] },
      ]),
    ).toThrow(/COMMON_WARM_DISH_VIOLATION/);

    expect(() =>
      assertCommonWarmDishAcrossPackages([
        { date: "2026-07-20", dish_key: "a", package_keys: ["BASIS", "LUXUS", "ENTERPRISE"] },
      ]),
    ).not.toThrow();
  });
});
