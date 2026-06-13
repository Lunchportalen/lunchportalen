/** Canonical operative slot for orders ↔ kitchen_batches join (baseline: `default`). */
export function normOperativeSlot(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s || s === "lunch") return "default";
  return s;
}

/** @deprecated Use normOperativeSlot — kept for call-site migration readability. */
export function normKitchenSlot(v: unknown): string {
  return normOperativeSlot(v);
}
