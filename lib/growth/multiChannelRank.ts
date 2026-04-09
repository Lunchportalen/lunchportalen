import type { ChannelMetricsMap } from "@/lib/growth/channelMetrics";

export function rankChannelsByEfficiency(metrics: ChannelMetricsMap): {
  bestChannel: string | null;
  worstChannel: string | null;
} {
  const scored = Object.entries(metrics).filter(([, m]) => m.posts > 0);
  if (scored.length === 0) return { bestChannel: null, worstChannel: null };
  const sorted = [...scored].sort((a, b) => b[1].revenuePerPost - a[1].revenuePerPost);
  return {
    bestChannel: sorted[0][0],
    worstChannel: sorted[sorted.length - 1][0],
  };
}
