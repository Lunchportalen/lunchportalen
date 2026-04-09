import { estimateElasticity } from "@/lib/pricing/elasticity";

export type DynamicPriceProduct = {
  price: number;
  cost: number;
  demandScore?: number;
  /** Oppjustert kost fra innkjøp (f.eks. beste leverandør) — brukes profit-first som max(kost, innkjøp). */
  procurementUnitCost?: number;
};

function effectiveCost(p: DynamicPriceProduct): number {
  const c = typeof p.cost === "number" && Number.isFinite(p.cost) && p.cost >= 0 ? p.cost : 0;
  const pc =
    typeof p.procurementUnitCost === "number" && Number.isFinite(p.procurementUnitCost) && p.procurementUnitCost >= 0
      ? p.procurementUnitCost
      : 0;
  return Math.max(c, pc);
}

export function suggestDynamicPrice(product: DynamicPriceProduct): number {
  const price = typeof product.price === "number" && Number.isFinite(product.price) && product.price > 0 ? product.price : 0;
  if (price <= 0) return 0;
  const cost = effectiveCost(product);
  const margin = (price - cost) / price;
  const elasticity = estimateElasticity(product);
  let newPrice = price;
  if (margin < 0.3) {
    newPrice *= 1.1;
  }
  if (elasticity === "low") {
    newPrice *= 1.05;
  }
  if (elasticity === "high") {
    newPrice *= 0.95;
  }
  return Math.round(newPrice);
}

/**
 * Multi-market list price (deterministic multipliers). Additive — does not replace {@link suggestDynamicPrice}.
 */
export function getPrice(basePrice: number, market: { country: string }): number {
  const multipliers: Record<string, number> = {
    NO: 1,
    SE: 1.1,
    DK: 1.15,
  };
  const c = String(market.country ?? "NO").trim().toUpperCase();
  const m = multipliers[c] ?? 1;
  const b = typeof basePrice === "number" && Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : 0;
  return Math.round(b * m * 100) / 100;
}
