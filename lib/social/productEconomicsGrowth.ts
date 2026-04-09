/**
 * Margin-/lagerbevisst rangering for vekst og kalender-tie-break (ingen kalender-import i runtime).
 */

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { CalendarPost } from "@/lib/social/calendar";
import type { ProductEconomics } from "@/lib/product/economics";
import { filterUnsafeProducts } from "@/lib/product/filter";
import { pickBestProducts } from "@/lib/product/prioritization";
import { socialRefToProductEconomics } from "@/lib/product/socialRefEconomics";
import {
  aggregateProductSignals,
  demandScoreFromSignals,
} from "@/lib/social/aggregateProductSignals";
import { reinforcementPatternsFromPosts } from "@/lib/social/learning";

export type RankedGrowthEconomics = ProductEconomics & { score: number };

export function rankGrowthEconomicsCandidates(
  products: SocialProductRef[],
  posts: CalendarPost[],
): RankedGrowthEconomics[] {
  const ok = products.filter((p) => String(p.name ?? "").trim().length >= 2);
  const agg = aggregateProductSignals(posts);
  const reinforcement = reinforcementPatternsFromPosts(posts);
  const winP = new Set(reinforcement.winningProductIds);
  const loseP = new Set(reinforcement.losingProductIds);

  const econList: ProductEconomics[] = [];
  for (const ref of ok) {
    const demand = demandScoreFromSignals(agg.get(ref.id));
    const econ = socialRefToProductEconomics(ref, demand);
    if (econ) econList.push(econ);
  }

  const safe = filterUnsafeProducts(econList);
  const scored = pickBestProducts(safe).map((row) => {
    let score = row.score;
    if (winP.has(row.productId)) score *= 1.1;
    if (loseP.has(row.productId)) score *= 0.9;
    return { ...row, score };
  });
  return scored.sort((a, b) => b.score - a.score);
}

export function growthEconomicsRankMap(products: SocialProductRef[], posts: CalendarPost[]): Map<string, number> {
  const ranked = rankGrowthEconomicsCandidates(products, posts);
  const m = new Map<string, number>();
  ranked.forEach((r, i) => m.set(r.productId, i));
  return m;
}
