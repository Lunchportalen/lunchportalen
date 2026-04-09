/**
 * Simulert lager / spoilage-risiko — deterministisk ut fra innkjøpslinjer og prognose.
 * Ingen faktisk WMS-kobling i V1; tall er forklarbare estimater for kontrolltårn.
 */

import type { ProcurementLine } from "@/lib/ai/procurementEngine";

export type InventoryRiskRow = {
  ingredient: string;
  stock: number;
  risk: "low" | "medium" | "high";
};

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Forbruksrate (kg/dag) forenklet: totalWithBuffer / max(1, predictedPortions) * skalar.
 */
export function assessInventoryFromProcurement(
  lines: ProcurementLine[],
  predictedPortions: number,
  snapshotSeed: string,
): InventoryRiskRow[] {
  const portions = Math.max(1, Math.round(predictedPortions));
  const out: InventoryRiskRow[] = [];

  for (const line of lines) {
    const key = String(line.ingredient ?? "").trim();
    if (!key) continue;
    const need = Math.max(0, line.totalWithBuffer);
    const h = hash32(`${snapshotSeed}|${key}`);
    const jitter = (h % 17) / 100; // 0–0.16
    const consumptionPerDay = need / portions;
    const stock = Math.round(need * (0.35 + jitter) * 10) / 10;
    const daysCover = consumptionPerDay > 1e-6 ? stock / consumptionPerDay : 999;
    let risk: InventoryRiskRow["risk"];
    if (daysCover >= 4.5) risk = "low";
    else if (daysCover >= 2.2) risk = "medium";
    else risk = "high";

    out.push({ ingredient: key, stock, risk });
  }

  return out.sort((a, b) => a.ingredient.localeCompare(b.ingredient, "nb"));
}
