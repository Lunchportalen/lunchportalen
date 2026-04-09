/**
 * Deterministisk kobling: post → ordre (social_post_id) + lead (source_post_id).
 */
import type { CollectedRevenueData } from "@/lib/revenue/collect";

export type RevenuePostModel = {
  postId: string;
  text: string;
  /** Kilde fra StandardSocialContentV1 når tilgjengelig — styrer trygge autopilot-forslag. */
  contentSource: string | null;
  leads: number;
  orders: number;
  revenue: number;
};

function readPostId(post: Record<string, unknown>): string | null {
  const id = post.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function readPostTextAndSource(post: Record<string, unknown>): { text: string; source: string | null } {
  const c = post.content;
  if (c && typeof c === "object" && !Array.isArray(c)) {
    const o = c as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text : "";
    const src = o.source;
    const source = typeof src === "string" && src.trim() ? src.trim().toLowerCase() : null;
    return { text: text.slice(0, 4000), source };
  }
  return { text: "", source: null };
}

function orderRevenue(o: Record<string, unknown>): number {
  const lt = o.line_total ?? o.total_amount;
  if (typeof lt === "number" && Number.isFinite(lt)) return lt;
  if (typeof lt === "string" && lt.trim()) {
    const n = Number(lt);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function orderPostId(o: Record<string, unknown>): string | null {
  const s = o.social_post_id;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

function leadPostId(l: Record<string, unknown>): string | null {
  const s = l.source_post_id;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

export function buildRevenueModel(data: CollectedRevenueData): RevenuePostModel[] {
  const result: RevenuePostModel[] = [];

  for (const post of data.posts) {
    const postId = readPostId(post);
    if (!postId) continue;

    const { text, source } = readPostTextAndSource(post);

    const relatedOrders = data.orders.filter((o) => orderPostId(o) === postId);
    const revenue = relatedOrders.reduce((sum, o) => sum + orderRevenue(o), 0);

    const leadRows = data.leads.filter((l) => leadPostId(l) === postId);

    result.push({
      postId,
      text,
      contentSource: source,
      leads: leadRows.length,
      orders: relatedOrders.length,
      revenue,
    });
  }

  return result;
}
