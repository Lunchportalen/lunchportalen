/**
 * Aggregerer faktisk omsetning per marked fra `content.market` / `meta.market` på poster.
 */
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

function postMarketKey(post: Record<string, unknown>): string {
  const c = post.content;
  if (c && typeof c === "object" && !Array.isArray(c)) {
    const m = (c as Record<string, unknown>).market;
    if (typeof m === "string" && m.trim()) return m.trim().toLowerCase();
  }
  const meta = post.meta;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const mid = (meta as Record<string, unknown>).market_id ?? (meta as Record<string, unknown>).market;
    if (typeof mid === "string" && mid.trim()) return mid.trim().toLowerCase();
  }
  return "unknown";
}

export type MarketPerformanceRow = {
  revenue: number;
  orders: number;
};

export type MarketPerformanceMap = Record<string, MarketPerformanceRow>;

export function trackMarketPerformance(posts: Record<string, unknown>[], orders: Record<string, unknown>[]): MarketPerformanceMap {
  const result: MarketPerformanceMap = {};
  const postList = Array.isArray(posts) ? posts : [];
  const orderList = Array.isArray(orders) ? orders : [];

  for (const post of postList) {
    if (!post || typeof post !== "object") continue;
    const market = postMarketKey(post as Record<string, unknown>);
    if (!result[market]) result[market] = { revenue: 0, orders: 0 };
  }

  const seenOrder = new Set<string>();
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
    const post = postList.find((p) => typeof p === "object" && p && (p as Record<string, unknown>).id === postId) as
      | Record<string, unknown>
      | undefined;
    const market = post ? postMarketKey(post) : "unknown";
    if (!result[market]) result[market] = { revenue: 0, orders: 0 };
    result[market].revenue += orderAmount(o);
    result[market].orders += 1;
  }

  return result;
}
