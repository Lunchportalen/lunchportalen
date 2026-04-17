import { describe, expect, it } from "vitest";

import type { EmployeeOwnLunchHistoryItem } from "@/lib/employee/employeeOwnLunchHistoryTypes";
import { groupEmployeePastLunchByWeekDescending } from "@/lib/employee/tidligereLunsjdagerGroup";

function item(date: string, id: string): EmployeeOwnLunchHistoryItem {
  return {
    sort_at: `${date}T10:00:00Z`,
    title_nb: "Aktiv",
    body_nb: "",
    delivery_date_iso: date,
    slot_label_nb: null,
    order_id: id,
    status_upper: "ACTIVE",
  };
}

describe("groupEmployeePastLunchByWeekDescending", () => {
  it("grupperer etter påfølgende uke når leveringsdato synker", () => {
    // 2026-04-15 er onsdag; mandag i samme uke er 2026-04-13
    const items = [item("2026-04-15", "a"), item("2026-04-14", "b"), item("2026-04-07", "c")];
    const g = groupEmployeePastLunchByWeekDescending(items);
    expect(g).toHaveLength(2);
    expect(g[0]?.weekStartIso).toBe("2026-04-13");
    expect(g[0]?.items.map((x) => x.order_id)).toEqual(["a", "b"]);
    expect(g[1]?.weekStartIso).toBe("2026-04-06");
    expect(g[1]?.items.map((x) => x.order_id)).toEqual(["c"]);
  });
});
