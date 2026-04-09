import type { MarketDef } from "@/lib/global/markets";
import { MARKETS } from "@/lib/global/markets";

export function getMarketContext(marketId: string): MarketDef | undefined {
  const id = typeof marketId === "string" ? marketId.trim().toLowerCase() : "";
  if (!id) return undefined;
  return MARKETS.find((m) => m.id === id);
}
