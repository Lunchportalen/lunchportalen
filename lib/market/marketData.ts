import "server-only";

import type { ExtractedSignals } from "@/lib/market/signalExtract";
import { storeMarketData } from "@/lib/market/performance";

export type MarketDataRow = {
  id: string;
  text: string;
  signals: ExtractedSignals;
  engagement: number;
  clicks: number;
  conversions: number;
};

/**
 * API-ready: koble til godkjent import / egen ytelsesbase. Default tom (fail-closed).
 */
export async function getMarketData(): Promise<MarketDataRow[]> {
  return [];
}

/**
 * Hjelper for tester / fremtidig kabel — bygger deterministisk rad fra eget utkast + målinger.
 */
export function toMarketDataRow(
  id: string,
  post: { text: string },
  metrics: { engagement: number; clicks: number; conversions: number },
): MarketDataRow {
  const stored = storeMarketData(post, metrics);
  return {
    id,
    text: post.text,
    signals: stored.signals,
    engagement: stored.engagement,
    clicks: stored.clicks,
    conversions: stored.conversions,
  };
}
