/**
 * Aggreger ordre-/salg-rader til {@link SalesPoint} (for fremtidig server-kobling).
 * Ren, deterministisk — ingen DB-kall her.
 */

import type { SalesPoint } from "@/lib/forecast/data";

export type OrderUnitRow = {
  date: string; // YYYY-MM-DD
  productId: string;
  units: number;
};

export function salesPointsFromOrderUnitRows(rows: OrderUnitRow[]): SalesPoint[] {
  const acc = new Map<string, number>();
  for (const r of Array.isArray(rows) ? rows : []) {
    const d = String(r.date ?? "").trim();
    const pid = String(r.productId ?? "").trim();
    const u = typeof r.units === "number" && Number.isFinite(r.units) ? Math.max(0, Math.floor(r.units)) : 0;
    if (!d || !pid) continue;
    const key = `${pid}\t${d}`;
    acc.set(key, (acc.get(key) ?? 0) + u);
  }
  const out: SalesPoint[] = [];
  for (const [key, units] of acc) {
    const [productId, date] = key.split("\t");
    out.push({ productId, date, units });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
