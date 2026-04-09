/**
 * Revenue-first metrics: orders.line_total + social_post_id = truth; clicks from metrics + logs.
 */
import type { CollectedLoopData } from "@/lib/revenue/data";
import { buildRevenueModel } from "@/lib/revenue/model";

export type PostRevenueMetric = {
  postId: string;
  revenue: number;
  orders: number;
  leads: number;
  clicks: number;
};

function readPostId(post: Record<string, unknown>): string | null {
  const id = post.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function clicksFromPostRow(post: Record<string, unknown>): number {
  const c = post.content;
  if (!c || typeof c !== "object" || Array.isArray(c)) return 0;
  const m = (c as Record<string, unknown>).metrics;
  if (!m || typeof m !== "object" || Array.isArray(m)) return 0;
  const cl = (m as Record<string, unknown>).clicks;
  if (typeof cl === "number" && Number.isFinite(cl)) return Math.max(0, Math.floor(cl));
  return 0;
}

function clicksFromLogs(postId: string, data: CollectedLoopData): number {
  let n = 0;
  for (const row of data.logs) {
    const meta = row.metadata as Record<string, unknown> | undefined;
    if (!meta || typeof meta !== "object") continue;
    const pid = meta.postId ?? meta.post_id;
    if (typeof pid === "string" && pid.trim() === postId) n += 1;
  }
  return n;
}

function totalClicksForPost(postId: string, data: CollectedLoopData): number {
  const post = data.posts.find((p) => readPostId(p) === postId);
  const fromRow = post ? clicksFromPostRow(post) : 0;
  const fromLogs = clicksFromLogs(postId, data);
  return Math.max(fromRow, fromLogs);
}

/**
 * Aggregates per-post metrics: orders = count of orders; revenue = sum(line_total).
 */
export function buildMetrics(data: CollectedLoopData): Record<string, PostRevenueMetric> {
  const model = buildRevenueModel(data);
  const out: Record<string, PostRevenueMetric> = {};
  for (const m of model) {
    out[m.postId] = {
      postId: m.postId,
      revenue: m.revenue,
      orders: m.orders,
      leads: m.leads,
      clicks: totalClicksForPost(m.postId, data),
    };
  }
  return out;
}
