/**
 * «Strøm» som snapshot — deterministisk liste av hendelser for observabilitet (polling fra API).
 */

import type { InventoryRiskRow } from "@/lib/ai/inventoryEngine";
import type { MultiCityBalanceRow } from "@/lib/ai/multiCityEngine";

export type DecisionStreamEvent = {
  id: string;
  at: string;
  kind: "demand" | "inventory" | "delivery" | "supplier" | "policy";
  summary: string;
  priority: number;
};

export function buildDecisionStreamSnapshot(input: {
  snapshotAsOf: string;
  ridPrefix: string;
  cityRows: MultiCityBalanceRow[];
  inventory: InventoryRiskRow[];
  routeSummary: string[];
  supplierNote: string;
  policyNotes: string[];
}): DecisionStreamEvent[] {
  const events: DecisionStreamEvent[] = [];
  const p = input.ridPrefix || "os";

  let seq = 0;
  const push = (kind: DecisionStreamEvent["kind"], summary: string, priority: number) => {
    seq += 1;
    events.push({
      id: `${p}-ev-${String(seq).padStart(3, "0")}`,
      at: `${input.snapshotAsOf}T12:00:00.000Z`,
      kind,
      summary,
      priority,
    });
  };

  for (const c of input.cityRows) {
    const ratio = c.capacity > 0 ? c.demand / c.capacity : 0;
    push(
      "demand",
      `${c.city}: etterspørsel ${c.demand} / kapasitet ${c.capacity} (belastning ${(ratio * 100).toFixed(0)} %). ${c.loadBalanceSuggestion}`,
      ratio >= 0.92 ? 80 : ratio >= 0.7 ? 50 : 20,
    );
  }

  for (const inv of input.inventory.filter((i) => i.risk !== "low").slice(0, 8)) {
    push("inventory", `${inv.ingredient}: estimert lager ${inv.stock} — risiko ${inv.risk}.`, inv.risk === "high" ? 85 : 55);
  }

  for (let i = 0; i < Math.min(6, input.routeSummary.length); i++) {
    push("delivery", `Rute ${i + 1}: ${input.routeSummary[i]}`, 30);
  }

  push("supplier", input.supplierNote, 40);

  for (const n of input.policyNotes.slice(0, 6)) {
    push("policy", n, 35);
  }

  return events.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}
