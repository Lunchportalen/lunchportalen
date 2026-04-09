import { calculateMargin, calculateProfitPerUnit, type ProductEconomics } from "@/lib/product/economics";

export function scoreProduct(p: ProductEconomics): number {
  const margin = calculateMargin(p);
  const profit = calculateProfitPerUnit(p);

  let score = 0;

  score += margin * 50;
  score += profit * 10;

  if (p.stock === 0) score -= 100;
  if (p.stock !== undefined && p.stock > 0 && p.stock < 10) score -= 20;

  if (p.demandScore !== undefined && Number.isFinite(p.demandScore) && p.demandScore > 0) {
    score += p.demandScore * 20;
  }

  return score;
}

export type ScoredProductEconomics = ProductEconomics & { score: number };

export function pickBestProducts(products: ProductEconomics[]): ScoredProductEconomics[] {
  const list = Array.isArray(products) ? products : [];
  return list
    .map((p) => ({ ...p, score: scoreProduct(p) }))
    .sort((a, b) => b.score - a.score);
}
