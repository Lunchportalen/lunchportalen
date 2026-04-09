/**
 * Produktøkonomi — deterministisk, kun for beslutningsstøtte (ingen auto-endring).
 */

export type ProductEconomics = {
  productId: string;
  price: number;
  cost: number;
  stock?: number;
  demandScore?: number;
};

export function hasValidProductEconomics(p: ProductEconomics): boolean {
  return (
    typeof p.price === "number" &&
    Number.isFinite(p.price) &&
    p.price > 0 &&
    typeof p.cost === "number" &&
    Number.isFinite(p.cost) &&
    p.cost >= 0
  );
}

export function calculateMargin(p: ProductEconomics): number {
  if (!p.price) return 0;
  if (!hasValidProductEconomics(p)) return 0;
  return (p.price - p.cost) / p.price;
}

export function calculateProfitPerUnit(p: ProductEconomics): number {
  if (!hasValidProductEconomics(p)) return 0;
  return p.price - p.cost;
}
