import { describe, it, expect } from "vitest";
import { buildProductionHierarchy } from "@/lib/kitchen/buildProductionHierarchy";
import type { KitchenRow } from "@/lib/kitchen/kitchenFetch";

/**
 * Closeout 5: produksjonshierarki (UI/print) skal være deterministisk gitt samme KitchenRow-mengde —
 * samme kilde som GET /api/kitchen `rows` etter server-sortering (slot → firma → lokasjon → ansatt → orderId).
 */

function walkOrderIds(h: ReturnType<typeof buildProductionHierarchy>): string[] {
  const out: string[] = [];
  for (const s of h) {
    for (const c of s.companies) {
      for (const loc of c.locations) {
        for (const r of loc.rows) {
          out.push(r.orderId);
        }
      }
    }
  }
  return out;
}

describe("buildProductionHierarchy — determinisme (live/snapshot-presentasjon)", () => {
  it("shuffle av identiske rader: samme dybde-først rekkefølge av orderId (ingen tilfeldig gruppering)", () => {
    const rows: KitchenRow[] = [
      {
        orderId: "o3",
        slot: "lunch",
        orderStatus: "ACTIVE",
        company: "Beta AS",
        location: "Hoved",
        employeeName: "Per",
        menu_title: "X",
        menu_description: null,
        menu_allergens: [],
      },
      {
        orderId: "o1",
        slot: "lunch",
        orderStatus: "ACTIVE",
        company: "Alfa AS",
        location: "Hoved",
        employeeName: "Kari",
        menu_title: "Y",
        menu_description: null,
        menu_allergens: [],
      },
      {
        orderId: "o2",
        slot: "dinner",
        orderStatus: "ACTIVE",
        company: "Alfa AS",
        location: "Filial",
        employeeName: "Bo",
        menu_title: "Z",
        menu_description: null,
        menu_allergens: [],
      },
    ];
    const canonical = walkOrderIds(buildProductionHierarchy(rows));
    const shuffled = [rows[2]!, rows[0]!, rows[1]!];
    const again = walkOrderIds(buildProductionHierarchy(shuffled));
    expect(again).toEqual(canonical);
    expect(canonical).toEqual(["o2", "o1", "o3"]);
  });

  it("samme antall rader ut som inn (ingen duplikat eller tap i hierarki)", () => {
    const rows: KitchenRow[] = [
      {
        orderId: "o1",
        slot: "lunch",
        orderStatus: "ACTIVE",
        company: "A",
        location: "L1",
        employeeName: "En",
        menu_title: null,
        menu_description: null,
        menu_allergens: [],
      },
      {
        orderId: "o2",
        slot: "lunch",
        orderStatus: "ACTIVE",
        company: "A",
        location: "L1",
        employeeName: "To",
        menu_title: null,
        menu_description: null,
        menu_allergens: [],
      },
    ];
    const h = buildProductionHierarchy(rows);
    expect(walkOrderIds(h)).toHaveLength(rows.length);
  });
});
