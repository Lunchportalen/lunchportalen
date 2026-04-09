import type { MarketContext } from "@/lib/ai/market/marketContext";

export function evaluateThreats(ctx: Pick<MarketContext, "competitors" | "growthRate">): string[] {
  const threats: string[] = [];
  const n = Array.isArray(ctx.competitors) ? ctx.competitors.length : 0;
  if (n > 3) {
    threats.push("HIGH_COMPETITION");
  }
  if (ctx.growthRate < 0.05) {
    threats.push("LOSING_MOMENTUM");
  }
  return threats;
}
