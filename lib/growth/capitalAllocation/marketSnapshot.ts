import type { CapitalChannelId, MarketSnapshot, RawMarketChannelMetrics } from "@/lib/growth/capitalAllocation/types";
import { CAPITAL_CHANNELS } from "@/lib/growth/capitalAllocation/types";

/** Aggregate market-level snapshot for rollback guards (mean of channel raw proxies + sum revenue). */
export function marketSnapshotFromRaw(
  raw: Record<CapitalChannelId, RawMarketChannelMetrics>,
): MarketSnapshot {
  let rev = 0;
  let retSum = 0;
  let dwellSum = 0;
  for (const c of CAPITAL_CHANNELS) {
    const cell = raw[c]!;
    rev += cell.revenue;
    retSum += cell.retention_proxy;
    dwellSum += cell.dwell_proxy;
  }
  const n = CAPITAL_CHANNELS.length;
  return {
    revenue: rev,
    retention: n > 0 ? retSum / n : 0,
    dwell: n > 0 ? dwellSum / n : 0,
  };
}
