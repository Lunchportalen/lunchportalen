import type { PostRevenueMetric } from "@/lib/revenue/metrics";

export type RevenueOpportunityType = "conversion_fix" | "scale_pattern";

export type RevenueOpportunity = {
  postId: string;
  type: RevenueOpportunityType;
  /** Lower sorts first (higher urgency). */
  priority: number;
};

/**
 * Deterministic rules — no AI. Same metrics → same ordering.
 */
export function findOpportunities(metrics: Record<string, PostRevenueMetric>): RevenueOpportunity[] {
  const list: RevenueOpportunity[] = [];

  for (const m of Object.values(metrics)) {
    if (m.clicks > 20 && m.orders === 0) {
      list.push({ postId: m.postId, type: "conversion_fix", priority: 1 });
    }
    if (m.revenue > 10000) {
      list.push({ postId: m.postId, type: "scale_pattern", priority: 0 });
    }
  }

  const best = new Map<string, RevenueOpportunity>();
  for (const o of list) {
    const prev = best.get(o.postId);
    if (!prev || o.priority < prev.priority) best.set(o.postId, o);
  }

  return [...best.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.postId.localeCompare(b.postId);
  });
}
