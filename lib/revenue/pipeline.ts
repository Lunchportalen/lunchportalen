/**
 * Bygg {@link RevenueEvent} fra ordre-lignende data — ufullstendig attributjon filtreres bort.
 */

import type { CalendarPost } from "@/lib/social/calendar";
import { scoreAttribution } from "@/lib/revenue/confidence";
import type { OrderAttributionRecord } from "@/lib/revenue/types";
import { isTraceableRevenueEvent, type RevenueEvent, type RevenueEventSource } from "@/lib/revenue/unified";

export type OrderRevenueInput = {
  id: string;
  productId: string;
  total: number;
  created_at: number;
  postId?: string;
  campaignId?: string;
  creativeId?: string;
  accountId?: string;
  source?: RevenueEventSource;
  cost?: number;
  margin?: number;
  attribution?: OrderAttributionRecord | null;
};

function mergeSource(body: RevenueEventSource | undefined, attr: OrderAttributionRecord | null | undefined): RevenueEventSource {
  if (body === "ads" || body === "direct") return body;
  if (body === "ai_social") return "ai_social";
  if (attr?.source === "ai_social") return "ai_social";
  if (attr?.postId?.trim()) return "ai_social";
  return "direct";
}

export function buildRevenueEvents(orders: OrderRevenueInput[]): RevenueEvent[] {
  const list = Array.isArray(orders) ? orders : [];
  const out: RevenueEvent[] = [];

  for (const o of list) {
    const id = String(o?.id ?? "").trim();
    const productId = String(o?.productId ?? "").trim();
    const total = o?.total;
    const created = o?.created_at;

    if (!id || !productId || typeof total !== "number" || !Number.isFinite(total) || total < 0) continue;
    if (typeof created !== "number" || !Number.isFinite(created)) continue;

    const attr = o.attribution && typeof o.attribution === "object" ? o.attribution : undefined;
    const postId = String(o.postId ?? attr?.postId ?? "").trim() || undefined;
    const campaignId = String(o.campaignId ?? attr?.campaignId ?? "").trim() || undefined;
    const creativeId = String(o.creativeId ?? attr?.creativeId ?? "").trim() || undefined;
    const accountId = String(o.accountId ?? attr?.accountId ?? "").trim() || undefined;

    const source = mergeSource(o.source, attr);

    const ev: RevenueEvent = {
      orderId: id,
      productId,
      amount: total,
      cost: typeof o.cost === "number" && Number.isFinite(o.cost) ? o.cost : undefined,
      margin: typeof o.margin === "number" && Number.isFinite(o.margin) ? o.margin : undefined,
      postId,
      campaignId,
      creativeId,
      accountId,
      source,
      timestamp: created,
    };

    if (!isTraceableRevenueEvent(ev)) continue;
    out.push(ev);
  }

  return out;
}

/**
 * Kalender-lag: attribuert omsetning per publisert post (ikke juridisk ordre — signal for motor og UI).
 */
export function buildRevenueEventsFromCalendarPosts(posts: CalendarPost[]): RevenueEvent[] {
  const out: RevenueEvent[] = [];
  for (const p of posts) {
    if (p.status !== "published" || !p.performance) continue;
    const amount = p.performance.revenue ?? 0;
    if (!(typeof amount === "number" && Number.isFinite(amount) && amount > 0)) continue;
    const ts =
      typeof p.publishedAt === "number" && Number.isFinite(p.publishedAt) ? p.publishedAt : p.scheduledAt;
    const creativeId = p.socialMedia?.itemId?.trim() || undefined;
    const hook = (p.hook ?? "").trim();
    const evBase: RevenueEvent = {
      orderId: `cal_${p.id}`,
      productId: p.productId,
      amount,
      postId: p.id,
      campaignId: p.id,
      creativeId: creativeId ?? (hook.length >= 4 ? `hook:${hook.slice(0, 64)}` : undefined),
      source: "ai_social",
      timestamp: typeof ts === "number" && Number.isFinite(ts) ? ts : Date.now(),
    };
    const ev: RevenueEvent = { ...evBase, confidence: scoreAttribution(evBase) };
    if (isTraceableRevenueEvent(ev)) out.push(ev);
  }
  return out;
}
