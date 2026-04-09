import type { OmniscientState } from "@/lib/ai/omniscientContext";

/**
 * Expansion path labels — recommendations only; no automatic market entry or pricing.
 */
export function suggestExpansion(state: OmniscientState): string[] {
  const expansion: string[] = [];
  if (state.traffic > 1000 && state.conversion > 0.02) {
    expansion.push("CREATE_NEW_MARKET_PAGES");
  }
  if (state.mrr > 50000) {
    expansion.push("ENTER_NEW_REGION");
  }
  if (state.churn < 0.03) {
    expansion.push("INCREASE_LTV_STRATEGY");
  }
  return expansion;
}
