import type { MarketContext } from "@/lib/ai/market/marketContext";

export function analyzeCompetitors(ctx: MarketContext): string[] {
  const insights: string[] = [];
  if (ctx.competitors.length === 0) {
    insights.push("NO_COMPETITOR_DATA");
  }
  if (ctx.priceIndex > 1.2) {
    insights.push("OVERPRICED_MARKET");
  }
  if (ctx.priceIndex < 0.8) {
    insights.push("UNDERPRICED_MARKET");
  }
  return insights;
}
