import type { ExtractedSignals, MarketPostLike } from "@/lib/market/signalExtract";
import { extractSignals } from "@/lib/market/signalExtract";

export type MarketEngagementMetrics = {
  engagement: number;
  clicks: number;
  conversions: number;
};

export type StoredMarketRow = {
  signals: ExtractedSignals;
  engagement: number;
  clicks: number;
  conversions: number;
};

/**
 * Lagrer kun strukturerte signaler + tall — ikke fulltekst-kopier av konkurrentinnhold.
 */
export function storeMarketData(post: MarketPostLike, metrics: MarketEngagementMetrics): StoredMarketRow {
  return {
    signals: extractSignals(post),
    engagement: metrics.engagement,
    clicks: metrics.clicks,
    conversions: metrics.conversions,
  };
}
