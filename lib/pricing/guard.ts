/**
 * Begrenser prishopp — fail-closed ved ekstreme endringer.
 */

export function validatePriceChange(oldPrice: number, newPrice: number): boolean {
  const o = typeof oldPrice === "number" && Number.isFinite(oldPrice) && oldPrice > 0 ? oldPrice : 0;
  const n = typeof newPrice === "number" && Number.isFinite(newPrice) ? newPrice : 0;
  if (o <= 0) return false;
  const change = (n - o) / o;
  if (change > 0.15) return false;
  if (change < -0.2) return false;
  return true;
}
