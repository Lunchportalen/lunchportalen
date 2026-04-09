/**
 * Meny-prioritering: etterspørsel + margin + lager (kun rangering, ingen auto-endring).
 */

export type ProductScore = {
  productId: string;
  forecast: number;
  margin: number;
  profitPerUnit: number;
  stock: number;
  score: number;
};

export type ProductMenuInput = Omit<ProductScore, "score">;

export function scoreProduct(p: {
  productId: string;
  forecast: number;
  margin: number;
  profitPerUnit: number;
  stock: number;
}): number {
  let s = 0;
  s += p.forecast * 2;
  s += p.margin * 50;
  s += p.profitPerUnit * 5;

  if (p.stock === 0) s -= 100;
  if (p.stock < 5) s -= 20;

  return s;
}

export function buildMenu(products: ProductMenuInput[], maxItems = 8): ProductScore[] {
  return [...products]
    .map((p) => ({ ...p, score: scoreProduct(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);
}
