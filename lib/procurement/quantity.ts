/**
 * Enhetsmengde fra etterspørsel (deterministisk buffer).
 */

export function calculateOrderQty(forecastPerDay: number, horizonDays: number, stock: number): number {
  const f = typeof forecastPerDay === "number" && Number.isFinite(forecastPerDay) ? Math.max(0, forecastPerDay) : 0;
  const h = typeof horizonDays === "number" && Number.isFinite(horizonDays) ? Math.max(0, horizonDays) : 0;
  const s = typeof stock === "number" && Number.isFinite(stock) ? Math.max(0, stock) : 0;
  const demand = f * h;
  const buffer = 1.2;
  const needed = Math.ceil(demand * buffer);
  return Math.max(0, needed - s);
}
