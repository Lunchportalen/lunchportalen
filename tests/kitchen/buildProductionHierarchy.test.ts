import { describe, it, expect } from "vitest";
import { buildProductionHierarchy, rowSlot } from "@/lib/kitchen/buildProductionHierarchy";
import type { KitchenRow } from "@/lib/kitchen/kitchenFetch";

describe("buildProductionHierarchy", () => {
  it("grupperer slot → firma → lokasjon med stabil sortering", () => {
    const rows: KitchenRow[] = [
      {
        orderId: "b",
        slot: "lunch",
        orderStatus: "ACTIVE",
        company: "Beta AS",
        location: "Hoved",
        employeeName: "Per",
        menu_title: "Varm",
        menu_description: null,
        menu_allergens: [],
      },
      {
        orderId: "a",
        slot: "lunch",
        orderStatus: "ACTIVE",
        company: "Alfa AS",
        location: "Hoved",
        employeeName: "Kari",
        menu_title: "Kald",
        menu_description: null,
        menu_allergens: [],
      },
    ];
    const h = buildProductionHierarchy(rows);
    expect(h).toHaveLength(1);
    expect(rowSlot({ ...rows[0]!, slot: "" })).toBe("lunch");
    expect(h[0]?.companies[0]?.company).toBe("Alfa AS");
    expect(h[0]?.companies[1]?.company).toBe("Beta AS");
  });

  it("presentasjon/paritet: antall rader i hierarki === antall KitchenRow (ingen tap/duplikat vs API-rows)", () => {
    const rows: KitchenRow[] = [
      {
        orderId: "00000001-0001-4001-8001-000000000001",
        slot: "lunch",
        orderStatus: "ACTIVE",
        company: "A",
        location: "L1",
        employeeName: "En",
        menu_title: "X",
        menu_description: null,
        menu_allergens: [],
      },
      {
        orderId: "00000002-0002-4002-8002-000000000002",
        slot: "dinner",
        orderStatus: "ACTIVE",
        company: "B",
        location: "L2",
        employeeName: "To",
        menu_title: "Y",
        menu_description: null,
        menu_allergens: [],
      },
    ];
    const h = buildProductionHierarchy(rows);
    let n = 0;
    for (const sl of h) {
      for (const co of sl.companies) {
        for (const loc of co.locations) {
          n += loc.rows.length;
        }
      }
    }
    expect(n).toBe(rows.length);
  });
});
