/**
 * Enhetsøkonomikk — forutsetter kjente pris/kost per produkt.
 */

export type UnitEconomicsProduct = {
  id: string;
  price: number;
  cost: number;
};

export type UnitEconomics = {
  productId: string;
  margin: number;
  profitPerUnit: number;
};

function finiteNum(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function unitEconomics(product: UnitEconomicsProduct): UnitEconomics {
  const price = finiteNum(product.price);
  const cost = finiteNum(product.cost);
  const id = String(product.id ?? "").trim() || "unknown";
  const margin = price > 0 ? (price - cost) / price : 0;
  return {
    productId: id,
    margin,
    profitPerUnit: price - cost,
  };
}
