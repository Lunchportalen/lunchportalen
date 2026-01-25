export type NormalizedOrderStatus = "ORDERED" | "CANCELLED" | "NO_SHOW" | "UNKNOWN";

/**
 * Tilpass listen hvis dere har egne enum-verdier i orders.status.
 * Poenget: ESG-laget tåler variasjoner uten å knuse.
 */
export function normalizeOrderStatus(raw: any): NormalizedOrderStatus {
  const s = String(raw ?? "").trim().toUpperCase();

  if (!s) return "UNKNOWN";

  // BESTILT
  if (["ORDERED", "PLACED", "ACTIVE", "CONFIRMED"].includes(s)) return "ORDERED";

  // AVBESTILT
  if (["CANCELLED", "CANCELED", "CANCEL", "VOID"].includes(s)) return "CANCELLED";

  // NO SHOW
  if (["NO_SHOW", "NOSHOW", "MISSED"].includes(s)) return "NO_SHOW";

  return "UNKNOWN";
}
