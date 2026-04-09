import type { ChannelPerformanceMap } from "@/lib/growth/channelPerformance";

export type ChannelRoiRow = {
  revenue: number;
  orders: number;
  posts: number;
  /** Omsetning per post (enkel effektivitet). */
  efficiency: number;
};

export type RoiMap = Record<string, ChannelRoiRow>;

/**
 * Deterministisk ROI/effektivitet per kanal fra aggregerte tall.
 */
export function computeROI(channelData: ChannelPerformanceMap): RoiMap {
  const result: RoiMap = {};
  for (const [channel, data] of Object.entries(channelData)) {
    const revenue = Math.max(0, Number(data.revenue) || 0);
    const posts = Math.max(0, Math.floor(Number(data.posts) || 0));
    const orders = Math.max(0, Math.floor(Number(data.orders) || 0));
    const efficiency = posts > 0 ? revenue / posts : 0;
    result[channel] = { revenue, orders, posts, efficiency };
  }
  return result;
}
