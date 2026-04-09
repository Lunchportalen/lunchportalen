/**
 * Orkestrering: dynamisk forslag → prisvakt → marginvakt (ingen auto-persist).
 */

import type { DynamicPriceProduct } from "@/lib/pricing/engine";
import { suggestDynamicPrice } from "@/lib/pricing/engine";
import type { ElasticityEstimate } from "@/lib/pricing/elasticity";
import { estimateElasticity } from "@/lib/pricing/elasticity";
import { validatePriceChange } from "@/lib/pricing/guard";
import { ensureMargin } from "@/lib/pricing/margin";

function effectiveCostForMargin(p: DynamicPriceProduct): number {
  const c = typeof p.cost === "number" && Number.isFinite(p.cost) && p.cost >= 0 ? p.cost : 0;
  const pc =
    typeof p.procurementUnitCost === "number" && Number.isFinite(p.procurementUnitCost) && p.procurementUnitCost >= 0
      ? p.procurementUnitCost
      : 0;
  return Math.max(c, pc);
}

export type SafeRetailPriceResult = {
  currentPrice: number;
  rawSuggested: number;
  suggestedPrice: number;
  marginBefore: number;
  marginAfter: number;
  elasticity: ElasticityEstimate;
  notes: string[];
  guardPassed: boolean;
};

export function suggestRetailPriceWithGuards(product: DynamicPriceProduct): SafeRetailPriceResult {
  const notes: string[] = [];
  const price = typeof product.price === "number" && Number.isFinite(product.price) && product.price > 0 ? product.price : 0;
  const ec = effectiveCostForMargin(product);
  const marginBefore = price > 0 ? (price - ec) / price : 0;

  if (price <= 0) {
    return {
      currentPrice: 0,
      rawSuggested: 0,
      suggestedPrice: 0,
      marginBefore: 0,
      marginAfter: 0,
      elasticity: "medium",
      notes: ["Mangler gyldig listepris — intet forslag."],
      guardPassed: false,
    };
  }

  const elasticity = estimateElasticity(product);
  const rawSuggested = suggestDynamicPrice(product);

  const guardPassed = validatePriceChange(price, rawSuggested);
  let afterGuard = rawSuggested;
  if (!guardPassed) {
    notes.push("Prisendring utenfor tillatt bånd (+15 % / −20 %) — forslaget avvises (fail-closed).");
    afterGuard = price;
  }

  const marginInput = {
    price,
    cost: product.cost,
    procurementUnitCost: product.procurementUnitCost,
  };
  const suggestedPrice = ensureMargin(marginInput, afterGuard);
  if (suggestedPrice !== afterGuard && afterGuard !== price) {
    notes.push("Minimum margin 25 % på ny pris — beholdt eller justert tilbake til gjeldende pris.");
  }
  if (suggestedPrice === price && rawSuggested !== price && guardPassed) {
    notes.push("Marginbeskyttelse: ingen endring av utsalgspris.");
  }

  const marginAfter = suggestedPrice > 0 ? (suggestedPrice - ec) / suggestedPrice : 0;

  return {
    currentPrice: price,
    rawSuggested,
    suggestedPrice,
    marginBefore,
    marginAfter,
    elasticity,
    notes,
    guardPassed,
  };
}
