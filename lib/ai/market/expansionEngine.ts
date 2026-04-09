import type { MarketContext } from "@/lib/ai/market/marketContext";

export function suggestExpansion(ctx: MarketContext, gaps: string[]): string[] {
  void ctx;
  const actions: string[] = [];
  if (gaps.includes("UNSERVED_DEMAND")) {
    actions.push("CREATE_LANDING_PAGES");
  }
  if (gaps.includes("EXPANDING_MARKET")) {
    actions.push("INCREASE_ACQUISITION");
  }
  return actions;
}
