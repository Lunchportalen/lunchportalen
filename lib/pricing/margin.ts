/**
 * Minimum margin på foreslått utsalgspris — ellers behold gjeldende pris.
 */

export type MarginProductInput = {
  price: number;
  cost: number;
  procurementUnitCost?: number;
};

function effectiveCost(p: MarginProductInput): number {
  const c = typeof p.cost === "number" && Number.isFinite(p.cost) && p.cost >= 0 ? p.cost : 0;
  const pc =
    typeof p.procurementUnitCost === "number" && Number.isFinite(p.procurementUnitCost) && p.procurementUnitCost >= 0
      ? p.procurementUnitCost
      : 0;
  return Math.max(c, pc);
}

export function ensureMargin(product: MarginProductInput, newPrice: number): number {
  const cost = effectiveCost(product);
  const np = typeof newPrice === "number" && Number.isFinite(newPrice) ? newPrice : 0;
  const fallback = typeof product.price === "number" && Number.isFinite(product.price) && product.price > 0 ? product.price : 0;
  if (np <= 0) return fallback;
  const margin = (np - cost) / np;
  if (margin < 0.25) {
    return fallback;
  }
  return np;
}
