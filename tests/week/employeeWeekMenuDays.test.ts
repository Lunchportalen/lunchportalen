import { describe, expect, it } from "vitest";
import type { MenuDay } from "@/lib/cms/menuDay";
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

  it("fyller dishes fra publiserte menuDays per dato", () => {
    const dates = ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19"];
    const menuByDate = new Map<string, MenuDay[]>([
      [
        "2026-06-15",
        [
          {
            _id: "menuDay-2026-06-15-BASIS-varmrett",
            date: "2026-06-15",
            planTier: "BASIS",
            category: "varmrett",
            mealTitle: "Testrett første ordre",
            title: "Testrett første ordre",
            isPublished: true,
          },
        ],
      ],
    ]);
    const rows = buildEmployeeWeekDayRows({
      dates,
      deliveryDayKeys: ["mon"],
      defaultTier: "BASIS",
      weekOffset: 1,
      menuByDate,
    });
    const mon = rows[0];
    expect(mon?.isPublished).toBe(true);
    expect(mon?.title).toBe("Testrett første ordre");
    expect(mon?.dishes).toEqual([
      { title: "Testrett første ordre", category: "varmrett", description: null },
    ]);
  });
});
