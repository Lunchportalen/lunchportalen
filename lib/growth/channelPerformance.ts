import "server-only";

import { normalizeChannelKey } from "@/lib/growth/channels";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "channel_performance";

export type ChannelPerformanceMap = Record<
  string,
  {
    revenue: number;
    orders: number;
    posts: number;
  }
>;

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/**
 * Aggregerer faktisk omsetning fra `orders.line_total` mot poster via `social_post_id` og `attribution.postId`.
 * Fail-closed: tom data ved manglende tabell/konfig.
 */
export async function getChannelPerformance(): Promise<ChannelPerformanceMap> {
  const empty: ChannelPerformanceMap = {};
  if (!hasSupabaseAdminConfig()) return empty;

  try {
    const admin = supabaseAdmin();
    const spOk = await verifyTable(admin, "social_posts", ROUTE);
    const ordOk = await verifyTable(admin, "orders", ROUTE);
    if (!spOk || !ordOk) return empty;

    const { data: posts, error: pErr } = await admin.from("social_posts").select("id, platform");
    if (pErr || !Array.isArray(posts)) return empty;

    const { data: orders, error: oErr } = await admin
      .from("orders")
      .select("id, line_total, social_post_id, attribution")
      .limit(12_000);
    if (oErr || !Array.isArray(orders)) return empty;

    const postChannel = new Map<string, string>();
    const map: ChannelPerformanceMap = {};

    for (const p of posts) {
      if (!p || typeof p !== "object") continue;
      const id = typeof (p as Record<string, unknown>).id === "string" ? String((p as Record<string, unknown>).id) : "";
      if (!id) continue;
      const ch = normalizeChannelKey((p as Record<string, unknown>).platform as string | undefined);
      postChannel.set(id, ch);
      if (!map[ch]) map[ch] = { revenue: 0, orders: 0, posts: 0 };
      map[ch]!.posts += 1;
    }

    const attributedOrderIds = new Set<string>();

    for (const o of orders) {
      if (!o || typeof o !== "object") continue;
      const oid = typeof (o as Record<string, unknown>).id === "string" ? String((o as Record<string, unknown>).id) : "";
      if (!oid || attributedOrderIds.has(oid)) continue;

      let postId = typeof (o as Record<string, unknown>).social_post_id === "string" ? String((o as Record<string, unknown>).social_post_id) : "";
      if (!postId) {
        const attr = (o as Record<string, unknown>).attribution;
        if (attr && typeof attr === "object" && !Array.isArray(attr)) {
          const pid = (attr as Record<string, unknown>).postId;
          if (typeof pid === "string" && pid.trim()) postId = pid.trim();
        }
      }
      if (!postId) continue;

      const ch = postChannel.get(postId) ?? "unknown";
      if (!map[ch]) map[ch] = { revenue: 0, orders: 0, posts: 0 };
      map[ch]!.revenue += num((o as Record<string, unknown>).line_total);
      map[ch]!.orders += 1;
      attributedOrderIds.add(oid);
    }

    return map;
  } catch {
    return empty;
  }
}
