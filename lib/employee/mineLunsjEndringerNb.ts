/** Visningstekst for employee ordrehistorikk — ingen ny ordresemantikk. */

export function mineLunsjOrderTitleNb(statusUpper: string): string {
  const u = String(statusUpper ?? "").trim().toUpperCase();
  if (u === "ACTIVE") return "Lunsj registrert (aktiv ordre)";
  if (u === "CANCELLED" || u === "CANCELED") return "Lunsj avbestilt";
  if (!u) return "Ordre uten status";
  return `Ordrestatus: ${u}`;
}
