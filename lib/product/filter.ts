import { calculateMargin, hasValidProductEconomics, type ProductEconomics } from "@/lib/product/economics";

export function filterUnsafeProducts(products: ProductEconomics[]): ProductEconomics[] {
  const list = Array.isArray(products) ? products : [];
  return list.filter((p) => {
    if (!hasValidProductEconomics(p)) return false;
    const margin = calculateMargin(p);
    if (margin < 0.2) return false;
    if (p.stock === 0) return false;
    return true;
  });
}
