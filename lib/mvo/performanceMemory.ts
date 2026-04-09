import type { MvoComboMetrics } from "./types";

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export type OrderForPerformance = {
  variant_channel?: string | null;
  variant_segment?: string | null;
  variant_timing?: string | null;
  line_total?: unknown;
  total_amount?: unknown;
};

/**
 * Omsetningsminne per variant-nøkkel (ordrer = sannhet — samme nøkkel som `computeMvoMetrics`).
 */
export function buildPerformanceMap(orders: OrderForPerformance[]): Record<string, MvoComboMetrics> {
  const map: Record<string, MvoComboMetrics> = {};

  for (const o of orders) {
    const ch = o.variant_channel?.trim() || "unknown";
    const seg = o.variant_segment?.trim() || "unknown";
    const tim = o.variant_timing?.trim() || "unknown";
    const key = [ch, seg, tim].join("|");

    if (!map[key]) {
      map[key] = { revenue: 0, count: 0 };
    }
    map[key].revenue += num(o.line_total ?? o.total_amount);
    map[key].count += 1;
  }

  return map;
}
