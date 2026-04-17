import { describe, it, expect } from "vitest";

import {
  buildCompanyOperativeDeliverySummary,
  sortOperativeDayRosterRows,
  type CompanyOperativeDayRosterRow,
} from "@/lib/server/admin/loadCompanyOperativeDayRoster";
import type { KitchenDayChoiceMapEntry, OperativeKitchenOrderRow } from "@/lib/server/kitchen/loadOperativeKitchenOrders";

describe("sortOperativeDayRosterRows", () => {
  it("sorterer deterministisk: slot → lokasjon → navn → bruker-id", () => {
    const rows: CompanyOperativeDayRosterRow[] = [
      {
        order_id: "o2",
        user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        employee_display_name: "Beta",
        location_id: "loc-b",
        location_label: "B-lok",
        slot_norm: "lunch",
        order_status: "ACTIVE",
        order_note: null,
        day_choice_note: null,
      },
      {
        order_id: "o1",
        user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        employee_display_name: "Alfa",
        location_id: "loc-a",
        location_label: "A-lok",
        slot_norm: "lunch",
        order_status: "ACTIVE",
        order_note: null,
        day_choice_note: null,
      },
      {
        order_id: "o3",
        user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        employee_display_name: "Gamma",
        location_id: "loc-a",
        location_label: "A-lok",
        slot_norm: "breakfast",
        order_status: "ACTIVE",
        order_note: null,
        day_choice_note: null,
      },
    ];
    const sorted = sortOperativeDayRosterRows(rows);
    expect(sorted.map((r) => r.order_id)).toEqual(["o3", "o1", "o2"]);
  });
});

describe("buildCompanyOperativeDeliverySummary", () => {
  const cid = "00000000-0000-4000-8000-0000000000bb";
  const lid = "00000000-0000-4000-8000-0000000000cc";
  const u1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const u2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("aggregerer lokasjon × slot og totals", () => {
    const operative: OperativeKitchenOrderRow[] = [
      {
        id: "o1",
        user_id: u1,
        company_id: cid,
        location_id: lid,
        note: "A",
        status: "ACTIVE",
        slot: "lunch",
      },
      {
        id: "o2",
        user_id: u2,
        company_id: cid,
        location_id: lid,
        note: "",
        status: "ACTIVE",
        slot: "lunch",
      },
    ];
    const dcMap = new Map<string, KitchenDayChoiceMapEntry>([
      [`${cid}|${lid}|${u2}`, { choice_key: "basis", note: "B", updated_at: null, status: "ACTIVE" }],
    ]);
    const locLabels = new Map([[lid, "Kontoret"]]);
    const s = buildCompanyOperativeDeliverySummary(operative, dcMap, locLabels);
    expect(s.totals.operative_orders).toBe(2);
    expect(s.totals.distinct_employees).toBe(2);
    expect(s.totals.locations_with_orders).toBe(1);
    expect(s.totals.slots_with_orders).toBe(1);
    expect(s.per_location_slot).toHaveLength(1);
    expect(s.per_location_slot[0]?.operative_orders).toBe(2);
    expect(s.per_location_slot[0]?.rows_with_order_note).toBe(1);
    expect(s.per_location_slot[0]?.rows_with_day_choice_note).toBe(1);
  });
});
