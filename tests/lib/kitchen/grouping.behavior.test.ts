// @ts-nocheck
import { describe, test, expect } from "vitest";

import { buildKitchenGroups, type DbOrderRow, type ProfileRow } from "../../../lib/kitchen/grouping";

describe("lib/kitchen/grouping – deterministic grouping & sorting", () => {
  test("groups are stable and employees are sorted by time → department → name", () => {
    const orders: DbOrderRow[] = [
      {
        id: "o2",
        user_id: "u2",
        note: null,
        created_at: "2026-02-01T07:15:00.000Z",
        company_id: "c1",
        location_id: "l1",
        companies: { id: "c1", name: "Firma A" },
        company_locations: {
          id: "l1",
          label: "Resepsjon",
          address_line1: "Gate 1",
          postal_code: "0001",
          city: "Oslo",
          delivery_json: { windowFrom: "10:30", windowTo: "11:00" },
        },
      } as any,
      {
        id: "o1",
        user_id: "u1",
        note: null,
        created_at: "2026-02-01T07:00:00.000Z",
        company_id: "c1",
        location_id: "l1",
        companies: { id: "c1", name: "Firma A" },
        company_locations: {
          id: "l1",
          label: "Resepsjon",
          address_line1: "Gate 1",
          postal_code: "0001",
          city: "Oslo",
          delivery_json: { windowFrom: "10:30", windowTo: "11:00" },
        },
      } as any,
      {
        id: "o3",
        user_id: "u3",
        note: null,
        created_at: "2026-02-01T07:15:00.000Z",
        company_id: "c1",
        location_id: "l1",
        companies: { id: "c1", name: "Firma A" },
        company_locations: {
          id: "l1",
          label: "Resepsjon",
          address_line1: "Gate 1",
          postal_code: "0001",
          city: "Oslo",
          delivery_json: { windowFrom: "10:30", windowTo: "11:00" },
        },
      } as any,
    ];

    const profiles = new Map<string, ProfileRow>([
      ["u1", { user_id: "u1", name: "Anna", department: "B" }],
      ["u2", { user_id: "u2", name: "Bjørn", department: "A" }],
      ["u3", { user_id: "u3", name: "Britt", department: "A" }],
    ]);

    const first = buildKitchenGroups(orders, profiles);
    const second = buildKitchenGroups([...orders].reverse(), profiles);

    // Deterministic / stable
    expect(second).toEqual(first);

    // Single group for same window/company/location
    expect(first).toHaveLength(1);
    const group = first[0];
    expect(group.deliveryWindow).toBe("10:30–11:00");
    expect(group.count).toBe(3);

    // Within the group: sorted by timeOslo, then department, then name
    const namesInOrder = group.orders.map((o) => o.name);
    expect(namesInOrder).toEqual(["Anna", "Bjørn", "Britt"]);
  });
});

