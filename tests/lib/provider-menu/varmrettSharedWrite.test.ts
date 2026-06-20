import { describe, expect, test } from "vitest";

import {
  getEmployeeVisibleOrderDates,
  isVarmrettDivergentForDate,
  snapshotBaselineFromRow,
  varmrettTierSignatures,
} from "@/lib/provider-menu/varmrettSharedWrite";
import type { ProviderMenuDayRow } from "@/lib/provider-menu/loadProviderMenuDays";

function row(
  partial: Partial<ProviderMenuDayRow> & Pick<ProviderMenuDayRow, "date" | "tier" | "mealTitle" | "description">,
): ProviderMenuDayRow {
  return {
    id: `id-${partial.tier}-${partial.date}`,
    category: "varmrett",
    allergens: [],
    estimatedCostPerPortion: null,
    sourcePackage: null,
    upgradeType: null,
    upgradeNote: null,
    approvedForPublish: false,
    customerVisible: false,
    status: "draft",
    ...partial,
  };
}

describe("varmrettSharedWrite", () => {
  test("isVarmrettDivergentForDate detects BASIS vs LUXUS mismatch", () => {
    const rows = [
      row({ date: "2026-04-06", tier: "BASIS", mealTitle: "A", description: "a" }),
      row({ date: "2026-04-06", tier: "LUXUS", mealTitle: "B", description: "b" }),
    ];
    expect(isVarmrettDivergentForDate(rows, "2026-04-06")).toBe(true);
  });

  test("isVarmrettDivergentForDate false when aligned", () => {
    const rows = [
      row({ date: "2026-04-06", tier: "BASIS", mealTitle: "A", description: "a" }),
      row({ date: "2026-04-06", tier: "LUXUS", mealTitle: "A", description: "a" }),
    ];
    expect(isVarmrettDivergentForDate(rows, "2026-04-06")).toBe(false);
  });

  test("snapshotBaselineFromRow copies content fields", () => {
    const snap = snapshotBaselineFromRow(
      row({
        date: "2026-04-06",
        tier: "BASIS",
        mealTitle: "Laks",
        description: "Med potet",
        allergens: ["fisk"],
        estimatedCostPerPortion: 12.5,
      }),
    );
    expect(snap.mealTitle).toBe("Laks");
    expect(snap.allergens).toEqual(["fisk"]);
    expect(snap.estimatedCostPerPortion).toBe(12.5);
  });

  test("varmrettTierSignatures includes tier prefixes", () => {
    const sigs = varmrettTierSignatures(
      [row({ date: "2026-04-06", tier: "BASIS", mealTitle: "A", description: "a" })],
      "2026-04-06",
    );
    expect(sigs[0]).toContain("BASIS:");
  });

  test("getEmployeeVisibleOrderDates returns bounded list", () => {
    const dates = getEmployeeVisibleOrderDates(new Date("2026-03-26T14:00:00+01:00"));
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.length).toBeLessThanOrEqual(15);
  });
});
