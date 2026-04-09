/**
 * Kalenderpost-ytelse: sporbar attributjon (klikk, leads, omsetning) + aggregering for motor / UI.
 * Ingen server-only — brukes i klientkomponenter.
 */

import type { CalendarPost, CalendarPostPerformance } from "@/lib/social/calendar";

export type PostPerformancePatch = Partial<CalendarPostPerformance>;

export type PostPerformanceRow = {
  id: string;
  engagement: number;
  content?: unknown;
};

export type RevenueByPostRow = {
  postId: string;
  revenue: number;
  conversions: number;
};

export type RevenueByProductRow = {
  productId: string;
  revenue: number;
  conversions: number;
};

export type RevenueByFormatRow = {
  formatKey: string;
  revenue: number;
  conversions: number;
};

export type VideoConversionFunnelMetrics = {
  videoViews: number;
  hookRetentionPct: number;
  completionRatePct: number;
  videoConversionRatePct: number;
};

function emptyPerformance(): CalendarPostPerformance {
  return { clicks: 0, conversions: 0, revenue: 0 };
}

function mergePerformance(
  prev: CalendarPostPerformance | undefined,
  patch: PostPerformancePatch,
): CalendarPostPerformance {
  const base = { ...emptyPerformance(), ...prev };
  const n: CalendarPostPerformance = {
    ...base,
    clicks: base.clicks + (patch.clicks ?? 0),
    conversions: base.conversions + (patch.conversions ?? 0),
    revenue: base.revenue + (patch.revenue ?? 0),
    leads: (base.leads ?? 0) + (patch.leads ?? 0),
    demoBookings: (base.demoBookings ?? 0) + (patch.demoBookings ?? 0),
    likes: (base.likes ?? 0) + (patch.likes ?? 0),
    imageClicks: (base.imageClicks ?? 0) + (patch.imageClicks ?? 0),
    imageConversions: (base.imageConversions ?? 0) + (patch.imageConversions ?? 0),
    videoViews: (base.videoViews ?? 0) + (patch.videoViews ?? 0),
    videoHookRetained: (base.videoHookRetained ?? 0) + (patch.videoHookRetained ?? 0),
    videoAttributedConversions: (base.videoAttributedConversions ?? 0) + (patch.videoAttributedConversions ?? 0),
    videoCompletions: (base.videoCompletions ?? 0) + (patch.videoCompletions ?? 0),
  };
  if (patch.hookRetentionRatePct != null) n.hookRetentionRatePct = patch.hookRetentionRatePct;
  if (patch.videoDropOffRatePct != null) n.videoDropOffRatePct = patch.videoDropOffRatePct;
  if (patch.videoCompletionRatePct != null) n.videoCompletionRatePct = patch.videoCompletionRatePct;
  return n;
}

/**
 * Inkrementell oppdatering av én posts performance (additive tellere).
 */
export function trackPost(posts: CalendarPost[], postId: string, patch: PostPerformancePatch): CalendarPost[] {
  return posts.map((p) => (p.id === postId ? { ...p, performance: mergePerformance(p.performance, patch) } : p));
}

export function trackPostPerformance(
  posts: CalendarPost[],
  postId: string,
  patch: PostPerformancePatch,
): { posts: CalendarPost[]; clicks: number } {
  const next = trackPost(posts, postId, patch);
  const post = next.find((q) => q.id === postId);
  const clicks = post?.performance?.clicks ?? 0;
  return { posts: next, clicks };
}

export function totalAttributedRevenue(posts: CalendarPost[]): number {
  const list = Array.isArray(posts) ? posts : [];
  return list.reduce((s, p) => s + (p.performance?.revenue ?? 0), 0);
}

export function aggregateRevenueByPost(posts: CalendarPost[]): RevenueByPostRow[] {
  const list = Array.isArray(posts) ? posts : [];
  const byId = new Map<string, { revenue: number; conversions: number }>();
  for (const p of list) {
    const r = p.performance?.revenue ?? 0;
    const c = p.performance?.conversions ?? 0;
    if (r <= 0 && c <= 0) continue;
    const prev = byId.get(p.id) ?? { revenue: 0, conversions: 0 };
    byId.set(p.id, { revenue: prev.revenue + r, conversions: prev.conversions + c });
  }
  return [...byId.entries()]
    .map(([postId, v]) => ({ postId, revenue: v.revenue, conversions: v.conversions }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function aggregateRevenueByProduct(posts: CalendarPost[]): RevenueByProductRow[] {
  const list = Array.isArray(posts) ? posts : [];
  const byProduct = new Map<string, { revenue: number; conversions: number }>();
  for (const p of list) {
    const r = p.performance?.revenue ?? 0;
    const c = p.performance?.conversions ?? 0;
    if (r <= 0 && c <= 0) continue;
    const prev = byProduct.get(p.productId) ?? { revenue: 0, conversions: 0 };
    byProduct.set(p.productId, { revenue: prev.revenue + r, conversions: prev.conversions + c });
  }
  return [...byProduct.entries()]
    .map(([productId, v]) => ({ productId, revenue: v.revenue, conversions: v.conversions }))
    .sort((a, b) => b.revenue - a.revenue);
}

function formatKeyForPost(p: CalendarPost): string {
  if ((p.performance?.videoViews ?? 0) > 0) return "video";
  if (p.socialMedia?.imageUrl) return "image";
  return "text";
}

export function aggregateRevenueByFormat(posts: CalendarPost[]): RevenueByFormatRow[] {
  const list = Array.isArray(posts) ? posts : [];
  const m = new Map<string, { revenue: number; conversions: number }>();
  for (const p of list) {
    const r = p.performance?.revenue ?? 0;
    const c = p.performance?.conversions ?? 0;
    if (r <= 0 && c <= 0) continue;
    const k = formatKeyForPost(p);
    const prev = m.get(k) ?? { revenue: 0, conversions: 0 };
    m.set(k, { revenue: prev.revenue + r, conversions: prev.conversions + c });
  }
  return [...m.entries()]
    .map(([formatKey, v]) => ({ formatKey, revenue: v.revenue, conversions: v.conversions }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Video-trakt — null når ingen video-visninger (fail-closed for funnel).
 */
export function videoConversionFunnelMetrics(
  perf: CalendarPostPerformance | undefined | null,
): VideoConversionFunnelMetrics | null {
  if (!perf) return null;
  const videoViews = perf.videoViews ?? 0;
  if (videoViews <= 0) return null;
  const hookRetained = perf.videoHookRetained ?? 0;
  const completions = perf.videoCompletions ?? 0;
  const vidConv = perf.videoAttributedConversions ?? 0;
  const hookRetentionPct =
    perf.hookRetentionRatePct != null
      ? perf.hookRetentionRatePct
      : videoViews > 0
        ? (hookRetained / videoViews) * 100
        : 0;
  const completionRatePct =
    perf.videoCompletionRatePct != null
      ? perf.videoCompletionRatePct
      : videoViews > 0
        ? (completions / videoViews) * 100
        : 0;
  const videoConversionRatePct = videoViews > 0 ? (vidConv / videoViews) * 100 : 0;
  return { videoViews, hookRetentionPct, completionRatePct, videoConversionRatePct };
}

export function pickBestPosts(posts: PostPerformanceRow[], limit = 5): PostPerformanceRow[] {
  const list = Array.isArray(posts) ? posts : [];
  return [...list].sort((a, b) => b.engagement - a.engagement).slice(0, limit);
}

/**
 * Datakilde kobles senere (SoMe-API / intern DB). Default: tom liste (fail-closed).
 */
export async function getTopPerformingPosts(): Promise<PostPerformanceRow[]> {
  return [];
}
