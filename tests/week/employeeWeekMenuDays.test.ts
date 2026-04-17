import { describe, expect, it } from "vitest";
import { buildEmployeeWeekDayRows } from "@/lib/week/employeeWeekMenuDays";

describe("buildEmployeeWeekDayRows", () => {
  it("bruker defaultTier for alle dager når tierByDay mangler", () => {
    const dates = ["2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16", "2026-04-17"];
    const rows = buildEmployeeWeekDayRows({
      dates,
      deliveryDayKeys: ["mon", "tue"],
      defaultTier: "LUXUS",
      weekOffset: 0,
      menuByDate: new Map(),
    });
    expect(rows.map((r) => r.tier)).toEqual(["LUXUS", "LUXUS", "LUXUS", "LUXUS", "LUXUS"]);
  });

  it("bruker tierByDay per ukedag når daymap er utfylt", () => {
    const dates = ["2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16", "2026-04-17"];
    const rows = buildEmployeeWeekDayRows({
      dates,
      deliveryDayKeys: ["mon", "tue", "wed", "thu", "fri"],
      defaultTier: "BASIS",
      tierByDay: { mon: "BASIS", tue: "LUXUS", wed: "BASIS", thu: "LUXUS", fri: "BASIS" },
      weekOffset: 0,
      menuByDate: new Map(),
    });
    expect(rows.map((r) => ({ k: r.dayKey, t: r.tier }))).toEqual([
      { k: "mon", t: "BASIS" },
      { k: "tue", t: "LUXUS" },
      { k: "wed", t: "BASIS" },
      { k: "thu", t: "LUXUS" },
      { k: "fri", t: "BASIS" },
    ]);
  });
});
