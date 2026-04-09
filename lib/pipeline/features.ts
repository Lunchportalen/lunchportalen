/**
 * Trekk ut forklarbare signaler for pipeline-prediksjon (deterministisk, ingen ML).
 */

export type ActivityRowLike = {
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type LeadRowLike = {
  id: string;
  created_at?: string | null;
  source_post_id?: string | null;
  meta?: Record<string, unknown> | null;
};

function activityRefsLead(leadId: string, meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta || typeof meta !== "object") return false;
  const lid = meta.leadId ?? meta.lead_id;
  if (lid != null && String(lid) === leadId) return true;
  return false;
}

function parseMetricsFromPostContent(content: unknown): {
  clicks: number;
  orders: number;
  views: number;
  conversions: number;
  revenue: number;
} {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return { clicks: 0, orders: 0, views: 0, conversions: 0, revenue: 0 };
  }
  const c = content as Record<string, unknown>;
  const m = c.metrics;
  if (!m || typeof m !== "object" || Array.isArray(m)) {
    return { clicks: 0, orders: 0, views: 0, conversions: 0, revenue: 0 };
  }
  const raw = m as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : 0;
  };
  return {
    clicks: num(raw.clicks),
    orders: num(raw.orders),
    views: num(raw.views),
    conversions: num(raw.conversions),
    revenue: num(raw.revenue),
  };
}

/**
 * @param postsById — `social_posts.id` → rad med `content` (metrics i content.metrics)
 */
export function extractFeatures(
  lead: LeadRowLike,
  activityLog: ActivityRowLike[],
  postsById: Map<string, { content?: unknown }>,
): {
  age_days: number;
  days_since_last_activity: number;
  activity_count: number;
  clicks: number;
  orders_historical: number;
  views: number;
  conversions: number;
  revenue: number;
} {
  const now = Date.now();
  const created = lead.created_at ? new Date(lead.created_at).getTime() : now;
  const age_ms = now - (Number.isFinite(created) ? created : now);
  const age_days = age_ms / 86_400_000;

  const leadId = String(lead.id ?? "").trim();
  const activities = (Array.isArray(activityLog) ? activityLog : []).filter((a) =>
    activityRefsLead(leadId, a.metadata ?? null),
  );

  const sorted = [...activities].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  const lastActivity = sorted.length ? sorted[sorted.length - 1] : null;
  const lastTs = lastActivity?.created_at ? new Date(lastActivity.created_at).getTime() : null;
  const days_since_last_activity =
    lastTs != null && Number.isFinite(lastTs) ? (now - lastTs) / 86_400_000 : 999;

  const postId = typeof lead.source_post_id === "string" ? lead.source_post_id.trim() : "";
  const post = postId ? postsById.get(postId) : undefined;
  const m = parseMetricsFromPostContent(post?.content);

  return {
    age_days: Number.isFinite(age_days) ? age_days : 0,
    days_since_last_activity: Number.isFinite(days_since_last_activity) ? days_since_last_activity : 999,
    activity_count: sorted.length,
    clicks: m.clicks,
    orders_historical: m.orders,
    views: m.views,
    conversions: m.conversions,
    revenue: m.revenue,
  };
}
