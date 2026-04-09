import "server-only";

/**
 * Enkel simulering — «close_deal» krever alltid godkjenning (fail-closed).
 */
export function simulateCEO(decision: string): { safe: boolean; impact: number; status?: "requires_approval" } {
  const s = String(decision ?? "").toLowerCase();
  if (s.includes("close_deal")) {
    return { safe: false, impact: 0, status: "requires_approval" };
  }
  return { safe: true, impact: 0.1 };
}
