import type { ChannelAggregateMap } from "@/lib/growth/channelData";

export type ChannelMetricsRow = {
  revenue: number;
  orders: number;
  posts: number;
  revenuePerPost: number;
  /** Orde-relativ til antall poster (enkel «effekt»-indikator, forklarbar). */
  conversionRate: number;
};

export type ChannelMetricsMap = Record<string, ChannelMetricsRow>;

export function computeChannelMetrics(data: ChannelAggregateMap): ChannelMetricsMap {
  const result: ChannelMetricsMap = {};
  const entries = Object.entries(data);

  for (const [channel, d] of entries) {
    const revenue = Math.max(0, Number(d.revenue) || 0);
    const orders = Math.max(0, Math.floor(Number(d.orders) || 0));
    const posts = Math.max(0, Math.floor(Number(d.posts) || 0));
    result[channel] = {
      revenue,
      orders,
      posts,
      revenuePerPost: posts > 0 ? revenue / posts : 0,
      conversionRate: posts > 0 ? orders / posts : 0,
    };
  }

  return result;
}
