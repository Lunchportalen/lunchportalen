/**
 * Canonical produksjonsgruppering: leveringsvindu → firma → lokasjon → ansatt (stabilt sortert, `nb`).
 * Delt av kjøkkenproduksjonsliste og utskriftsflate — ingen egen ordrelogikk.
 * Samme dimensjoner som sorteringen i GET /api/kitchen (`rows.sort`: slot → company → location → employeeName → orderId).
 */
import type { KitchenRow } from "@/lib/kitchen/kitchenFetch";

export function rowSlot(r: KitchenRow): string {
  const s = String(r.slot ?? "").trim().toLowerCase();
  return s || "lunch";
}

export function mealLabel(row: KitchenRow): string {
  const t = String(row.menu_title ?? "").trim();
  return t || "Uten menyvalg";
}

export function slotHeading(slot: string): string {
  const s = String(slot ?? "").trim().toLowerCase();
  if (s === "lunch") return "Lunsj";
  if (s === "dinner" || s === "middag") return "Middag";
  return slot || "Leveringsvindu";
}

export type ProductionHierarchyLocation = { location: string; rows: KitchenRow[] };
export type ProductionHierarchyCompany = { company: string; locations: ProductionHierarchyLocation[] };
export type ProductionHierarchySlot = { slot: string; companies: ProductionHierarchyCompany[] };

export function buildProductionHierarchy(rows: KitchenRow[]): ProductionHierarchySlot[] {
  const bySlot = new Map<string, Map<string, Map<string, KitchenRow[]>>>();

  for (const r of rows) {
    const sl = rowSlot(r);
    if (!bySlot.has(sl)) bySlot.set(sl, new Map());
    const coMap = bySlot.get(sl)!;
    if (!coMap.has(r.company)) coMap.set(r.company, new Map());
    const locMap = coMap.get(r.company)!;
    if (!locMap.has(r.location)) locMap.set(r.location, []);
    locMap.get(r.location)!.push(r);
  }

  const slots = [...bySlot.keys()].sort((a, b) => a.localeCompare(b, "nb"));
  return slots.map((slot) => {
    const coMap = bySlot.get(slot)!;
    const companies = [...coMap.keys()]
      .sort((a, b) => a.localeCompare(b, "nb"))
      .map((company) => {
        const locMap = coMap.get(company)!;
        const locations = [...locMap.keys()]
          .sort((a, b) => a.localeCompare(b, "nb"))
          .map((location) => {
            const locRows = [...(locMap.get(location) ?? [])];
            locRows.sort((a, b) => {
              const n = a.employeeName.localeCompare(b.employeeName, "nb");
              if (n !== 0) return n;
              return String(a.orderId ?? "").localeCompare(String(b.orderId ?? ""), "nb");
            });
            return { location, rows: locRows };
          });
        return { company, locations };
      });
    return { slot, companies };
  });
}
