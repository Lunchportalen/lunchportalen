import "server-only";

import { mapPlatformToCapitalChannel } from "@/lib/growth/capitalAllocation/channels";
import type { CapitalChannelId, RawMarketChannelMetrics } from "@/lib/growth/capitalAllocation/types";
import { CAPITAL_CHANNELS } from "@/lib/growth/capitalAllocation/types";
import { listConfiguredMarkets, resolveMarketFromPost } from "@/lib/growth/capitalAllocation/markets";

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
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

function viewsFromContent(content: unknown): number {
  if (!content || typeof content !== "object" || Array.isArray(content)) return 1;
  const m = (content as Record<string, unknown>).metrics;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const v = (m as Record<string, unknown>).views;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.max(1, v);
  }
  return 1;
}

function clicksFromContent(content: unknown): number {
  if (!content || typeof content !== "object" || Array.isArray(content)) return 0;
  const m = (content as Record<string, unknown>).metrics;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const c = (m as Record<string, unknown>).clicks;
    if (typeof c === "number" && Number.isFinite(c) && c >= 0) return c;
  }
  return 0;
}

type Acc = RawMarketChannelMetrics & { _views: number; _clicks: number };

function emptyCell(): Acc {
  return {
    revenue: 0,
    orders: 0,
    sessions: 0,
    revenue_per_session: 0,
    retention_proxy: 0,
    dwell_proxy: 0,
    _views: 0,
    _clicks: 0,
  };
}

function finalizeCell(c: Acc): RawMarketChannelMetrics {
  const s = Math.max(0, c.sessions);
  const revenue = Math.max(0, c.revenue);
  const orders = Math.max(0, Math.floor(c.orders));
  const rps = s > 0 ? revenue / s : 0;
  const ret = s > 0 ? Math.min(1, orders / (s * 0.05 + 1)) : 0;
  const dwell = c._views > 0 ? Math.min(1, c._clicks / c._views) : 0;
  return {
    revenue,
    orders,
    sessions: s,
    revenue_per_session: rps,
    retention_proxy: ret,
    dwell_proxy: dwell > 0 ? dwell : orders > 0 && s > 0 ? Math.min(1, orders / (s * 0.01 + 1)) : 0,
  };
}

/**
 * Aggregates revenue/orders/sessions and proxies for retention & dwell per (market, channel).
 */
export function aggregateMarketChannelMetrics(args: {
  posts: Record<string, unknown>[];
  orders: Record<string, unknown>[];
}): Record<string, Record<CapitalChannelId, RawMarketChannelMetrics>> {
  const markets = listConfiguredMarkets();
  const allowed = new Set(markets);

  const acc: Record<string, Record<CapitalChannelId, Acc>> = {};
  for (const m of markets) {
    acc[m] = {} as Record<CapitalChannelId, Acc>;
    for (const ch of CAPITAL_CHANNELS) {
      acc[m]![ch] = emptyCell();
    }
  }

  const postMeta = new Map<string, { market: string; channel: CapitalChannelId; content: unknown }>();

  for (const post of args.posts) {
    if (!post || typeof post !== "object") continue;
    const id = typeof post.id === "string" ? post.id.trim() : "";
    if (!id) continue;
    const market = resolveMarketFromPost(post, allowed);
    const channel = mapPlatformToCapitalChannel(post.platform as string | undefined);
    const content = post.content;
    postMeta.set(id, { market, channel, content });

    const views = viewsFromContent(content);
    const clicks = clicksFromContent(content);
    const cell = acc[market]![channel]!;
    cell.sessions += views;
    cell._views += views;
    cell._clicks += clicks;
  }

  const seenOrder = new Set<string>();

  for (const raw of args.orders) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const oid = typeof o.id === "string" ? o.id.trim() : "";
    if (oid) {
      if (seenOrder.has(oid)) continue;
      seenOrder.add(oid);
    }
    const pid = orderPostId(o);
    if (!pid) continue;
    const meta = postMeta.get(pid);
    if (!meta) continue;
    const { market, channel } = meta;
    const cell = acc[market]![channel]!;
    cell.orders += 1;
    cell.revenue += num(o.line_total);
  }

  const out: Record<string, Record<CapitalChannelId, RawMarketChannelMetrics>> = {};
  for (const m of markets) {
    out[m] = {} as Record<CapitalChannelId, RawMarketChannelMetrics>;
    for (const ch of CAPITAL_CHANNELS) {
      out[m]![ch] = finalizeCell(acc[m]![ch]!);
    }
  }

  return out;
}
