import type { MarketContext } from "@/lib/ai/market/marketContext";

export function detectMarketGaps(ctx: MarketContext): string[] {
  const gaps: string[] = [];
  if (ctx.marketTraffic > 10000 && ctx.demandSignals.length === 0) {
    gaps.push("UNSERVED_DEMAND");
  }
  if (ctx.growthRate > 0.1) {
    gaps.push("EXPANDING_MARKET");
  }
  return gaps;
}
