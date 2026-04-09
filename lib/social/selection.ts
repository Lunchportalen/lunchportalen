/**

 * Produktvalg for vekstmotor — margin-, lager- og etterspørselssignaler (profit-first).

 * Ren funksjon; brukes ved siden av kalenderens {@link pickBestProduct}.

 */



import type { SocialProductRef } from "@/lib/ai/socialStrategy";

import type { CalendarPost } from "@/lib/social/calendar";

import {

  rankGrowthEconomicsCandidates,

  type RankedGrowthEconomics,

} from "@/lib/social/productEconomicsGrowth";



export type { ProductGrowthSignals } from "@/lib/social/aggregateProductSignals";

export { aggregateProductSignals } from "@/lib/social/aggregateProductSignals";



export type { RankedGrowthEconomics };



export { growthEconomicsRankMap } from "@/lib/social/productEconomicsGrowth";



export function pickBestProductsForGrowth(

  products: SocialProductRef[],

  posts: CalendarPost[],

): Array<RankedGrowthEconomics & { ref: SocialProductRef }> {

  const ok = products.filter((p) => String(p.name ?? "").trim().length >= 2);

  const byId = new Map(ok.map((r) => [r.id, r]));

  return rankGrowthEconomicsCandidates(products, posts)

    .map((row) => {

      const ref = byId.get(row.productId);

      return ref ? { ...row, ref } : null;

    })

    .filter((x): x is RankedGrowthEconomics & { ref: SocialProductRef } => x != null);

}



/**

 * Velg beste produkt: trygge kandidater etter filter + pickBestProducts,

 * med forsterkningssignal fra publisert historikk.

 */

export function pickBestProductForGrowth(

  products: SocialProductRef[],

  posts: CalendarPost[],

): SocialProductRef | null {

  const ranked = pickBestProductsForGrowth(products, posts);

  return ranked[0]?.ref ?? null;

}


