/**
 * Aggregerer faktisk omsetning per kanal fra `social_posts` + `orders`.
 * Ordre telles én gang; `social_post_id` og `attribution.postId` støttes (samme som channelPerformance).
 */
import { normalizeChannelKey } from "@/lib/growth/channels";

export type ChannelAggregateRow = {
  revenue: number;
  orders: number;
  posts: number;
};

export type ChannelAggregateMap = Record<string, ChannelAggregateRow>;

function orderAmount(o: Record<string, unknown>): number {
  const lt = o.line_total ?? o.total_amount;
  if (typeof lt === "number" && Number.isFinite(lt)) return lt;
  if (typeof lt === "string" && lt.trim()) {
    const n = Number(lt);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function orderPostId(o: Record<string, unknown>): string | null {
  const sid = o.social_post_id;
  if (typeof sid === "string" && sid.trim()) return sid.trim();
  const attr = o.attribution;
  if (attr && typeof attr === "object" && !Array.isArray(attr)) {
    const pid = (attr as Record<string, unknown>).postId;
    if (typeof pid === "string" && pid.trim()) return pid.trim();
  }
  return null;
}

export function extractChannelData(
  posts: Record<string, unknown>[],
  orders: Record<string, unknown>[],
): ChannelAggregateMap {
  const map: ChannelAggregateMap = {};
  const postIdToChannel = new Map<string, string>();

  const postList = Array.isArray(posts) ? posts : [];
  for (const post of postList) {
    if (!post || typeof post !== "object") continue;
    const p = post as Record<string, unknown>;
    const id = typeof p.id === "string" ? p.id.trim() : "";
    if (!id) continue;
    const channel = normalizeChannelKey(p.platform as string | undefined);
    postIdToChannel.set(id, channel);
    if (!map[channel]) map[channel] = { revenue: 0, orders: 0, posts: 0 };
    map[channel].posts += 1;
  }

  const seenOrder = new Set<string>();
  const orderList = Array.isArray(orders) ? orders : [];

  for (const raw of orderList) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const oid = typeof o.id === "string" ? o.id.trim() : "";
    if (oid) {
      if (seenOrder.has(oid)) continue;
      seenOrder.add(oid);
    }
    const postId = orderPostId(o);
    if (!postId) continue;
    const channel = postIdToChannel.get(postId) ?? "unknown";
    if (!map[channel]) map[channel] = { revenue: 0, orders: 0, posts: 0 };
    map[channel].revenue += orderAmount(o);
    map[channel].orders += 1;
  }

  return map;
}
