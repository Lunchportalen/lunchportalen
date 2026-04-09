import type { MarketContext } from "@/lib/ai/market/marketContext";

export type CategoryMode = "CREATE_NEW_CATEGORY" | "OWN_EXISTING_CATEGORY";

export function defineCategory(ctx: Pick<MarketContext, "marketTraffic">): CategoryMode {
  if (ctx.marketTraffic < 1000) {
    return "CREATE_NEW_CATEGORY";
  }
  return "OWN_EXISTING_CATEGORY";
}
