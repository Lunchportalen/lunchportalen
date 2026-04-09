/**
 * Deterministisk variantvalg per bruker-id (stabil hash, ingen RNG).
 */
export function pickVariant(userId: string): "A" | "B" {
  const s = String(userId ?? "").trim();
  if (!s) return "A";
  const hash = [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 2 === 0 ? "A" : "B";
}
