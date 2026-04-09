import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { CalendarPost } from "@/lib/social/calendar";
import {
  aggregateProductSignals,
  demandScoreFromSignals,
} from "@/lib/social/aggregateProductSignals";
import { calculateMargin, calculateProfitPerUnit } from "@/lib/product/economics";
import { filterUnsafeProducts } from "@/lib/product/filter";
import { inventorySignal, type InventorySignalLevel } from "@/lib/product/inventory";
import { pickBestProducts } from "@/lib/product/prioritization";
import { summarizePricingSuggestion } from "@/lib/product/pricing";
import { socialRefToProductEconomics } from "@/lib/product/socialRefEconomics";

export type ProductPrioritizationRow = {
  productId: string;
  name: string;
  marginPct: number;
  profitPerUnit: number;
  stock: number | undefined;
  inventorySignal: InventorySignalLevel;
  score: number;
  safeForPromotion: boolean;
};

export function buildProductPrioritizationRows(
  products: SocialProductRef[],
  posts: CalendarPost[],
): ProductPrioritizationRow[] {
  const agg = aggregateProductSignals(posts);
  const list = Array.isArray(products) ? products : [];
  const rows: ProductPrioritizationRow[] = [];

  for (const ref of list) {
    const name = String(ref.name ?? "").trim() || ref.id;
    const demand = demandScoreFromSignals(agg.get(ref.id));
    const econ = socialRefToProductEconomics(ref, demand);
    if (!econ) {
      rows.push({
        productId: ref.id,
        name,
        marginPct: 0,
        profitPerUnit: 0,
        stock: ref.stock,
        inventorySignal: "normal",
        score: 0,
        safeForPromotion: false,
      });
      continue;
    }
    const safeList = filterUnsafeProducts([econ]);
    const safeForPromotion = safeList.length === 1;
    const scored = pickBestProducts([econ])[0];
    rows.push({
      productId: econ.productId,
      name,
      marginPct: calculateMargin(econ) * 100,
      profitPerUnit: calculateProfitPerUnit(econ),
      stock: econ.stock,
      inventorySignal: inventorySignal(econ),
      score: scored?.score ?? 0,
      safeForPromotion,
    });
  }

  return rows.sort((a, b) => b.score - a.score);
}

export type ProductPricingRow = NonNullable<ReturnType<typeof summarizePricingSuggestion>> & {
  productId: string;
  name: string;
};

export function buildProductPricingSuggestionRows(products: SocialProductRef[]): ProductPricingRow[] {
  const list = Array.isArray(products) ? products : [];
  const out: ProductPricingRow[] = [];
  for (const ref of list) {
    const econ = socialRefToProductEconomics(ref);
    if (!econ) continue;
    const s = summarizePricingSuggestion(econ);
    if (!s) continue;
    out.push({
      productId: ref.id,
      name: String(ref.name ?? "").trim() || ref.id,
      ...s,
    });
  }
  return out;
}
