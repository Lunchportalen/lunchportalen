import { calculateMargin, hasValidProductEconomics, type ProductEconomics } from "@/lib/product/economics";

/**
 * Forslag til pris — aldri bruk til å persistere uten eksplisitt menneskelig beslutning.
 */
export function suggestPrice(p: ProductEconomics): number {
  if (!hasValidProductEconomics(p)) return typeof p.price === "number" && Number.isFinite(p.price) ? p.price : 0;
  const margin = calculateMargin(p);
  if (margin < 0.3) {
    return p.price * 1.1;
  }
  if (margin > 0.6) {
    return p.price * 0.95;
  }
  return p.price;
}

export type PricingSuggestionSummary = {
  currentPrice: number;
  suggestedPrice: number;
  delta: number;
  deltaPct: number;
  rationale: string;
};

export function summarizePricingSuggestion(p: ProductEconomics): PricingSuggestionSummary | null {
  if (!hasValidProductEconomics(p)) return null;
  const currentPrice = p.price;
  const suggestedPrice = suggestPrice(p);
  const delta = suggestedPrice - currentPrice;
  const deltaPct = currentPrice > 0 ? delta / currentPrice : 0;
  const margin = calculateMargin(p);
  let rationale = "Pris innenfor anbefalt marginbånd — ingen justering foreslått.";
  if (margin < 0.3) {
    rationale = "Lav margin — forslag om moderat prisøkning (+10 %) for å beskytte dekningsbidrag (kun forslag).";
  } else if (margin > 0.6) {
    rationale = "Høy margin — valgfritt prisgrep −5 % kan øke volum uten å knekke økonomi (kun forslag).";
  }
  return {
    currentPrice,
    suggestedPrice,
    delta,
    deltaPct,
    rationale,
  };
}
