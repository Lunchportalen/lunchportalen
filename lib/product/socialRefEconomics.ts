import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { ProductEconomics } from "@/lib/product/economics";

export function socialRefToProductEconomics(
  ref: SocialProductRef,
  demandScore?: number,
): ProductEconomics | null {
  const id = String(ref.id ?? "").trim();
  if (!id) return null;
  const price = ref.price;
  const cost = ref.cost;
  if (!(typeof price === "number" && Number.isFinite(price) && price > 0)) return null;
  if (!(typeof cost === "number" && Number.isFinite(cost) && cost >= 0)) return null;
  const stock = ref.stock;
  const econ: ProductEconomics = {
    productId: id,
    price,
    cost,
    stock: typeof stock === "number" && Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : undefined,
  };
  if (demandScore !== undefined && Number.isFinite(demandScore) && demandScore > 0) {
    econ.demandScore = demandScore;
  }
  return econ;
}
