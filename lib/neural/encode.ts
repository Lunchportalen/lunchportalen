/**
 * Deterministic numeric encoding (no external ML).
 */
export function encodeState(s: Record<string, unknown>): [number, number, number] {
  return [Number(s.orders ?? 0), Number(s.users ?? 0), Number(s.conversionRate ?? 0)];
}
