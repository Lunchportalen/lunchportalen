/**
 * Kostnad per vunnet kunde (kanal / kampanje) — deterministisk.
 */
export function calculateCAC(spend: number, customers: number): number {
  const s = Number.isFinite(spend) ? Math.max(0, spend) : 0;
  const c = Number.isFinite(customers) ? Math.floor(customers) : 0;
  if (!c) return 0;
  return s / c;
}
