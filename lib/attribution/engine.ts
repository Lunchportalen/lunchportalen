export type AttributionEvent = {
  variantId: string;
  value: number;
};

/**
 * Sums revenue (or value) per variant id — deterministic fold.
 */
export function attributeRevenue(events: AttributionEvent[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of events) {
    const id = String(e.variantId ?? "").trim();
    if (!id) continue;
    const v = Number.isFinite(e.value) ? e.value : 0;
    map[id] = (map[id] ?? 0) + v;
  }
  return map;
}
