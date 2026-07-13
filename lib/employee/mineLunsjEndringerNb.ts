/** Visningstekst for employee ordrehistorikk — ingen ny ordresemantikk. */

export function mineLunsjOrderTitleNb(statusUpper: string): string {
  const u = String(statusUpper ?? "").trim().toUpperCase();
  if (u === "ACTIVE") return "Lunsj registrert (aktiv ordre)";
  if (u === "CANCELLED" || u === "CANCELED") return "Lunsj avbestilt";
  if (u === "PREPARED" || u === "IN_PRODUCTION") return "Lunsj i produksjon";
  if (u === "READY" || u === "READY_FOR_DELIVERY") return "Lunsj klar for levering";
  if (u === "DELIVERED" || u === "COMPLETED") return "Lunsj levert";
  if (!u) return "Ordre uten status";
  // Fail-closed display: never leak raw DB enum values to the employee UI.
  return "Ordre registrert";
}
