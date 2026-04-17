// tests/admin/adminCountsContract.test.ts — Company admin tower: AdminCounts må matche overview-KPI
import { describe, test, expect } from "vitest";
import type { AdminCounts } from "@/lib/admin/loadAdminContext";

describe("AdminCounts (2C1 company admin overview)", () => {
  test("inneholder alle KPI-felt som brukes på /admin", () => {
    const c: AdminCounts = {
      employeesTotal: 0,
      employeesActive: 0,
      employeesDisabled: 0,
      locationsTotal: 0,
      ordersTodayActive: 0,
      ordersWeekActive: 0,
    };
    expect(c).toHaveProperty("locationsTotal");
    expect(c).toHaveProperty("ordersTodayActive");
    expect(c).toHaveProperty("ordersWeekActive");
  });
});
