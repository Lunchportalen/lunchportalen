/**
 * Aggreger signaler per produkt fra kalenderhistorikk (alle status unntatt kansellert).
 */

import type { CalendarPost } from "@/lib/social/calendar";

export type ProductGrowthSignals = {
  productId: string;
  revenue: number;
  conversions: number;
  clicks: number;
  postCount: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function aggregateProductSignals(posts: CalendarPost[]): Map<string, ProductGrowthSignals> {
  const m = new Map<string, ProductGrowthSignals>();
  for (const p of posts) {
    if (p.status === "cancelled") continue;
    const id = String(p.productId ?? "").trim();
    if (!id) continue;
    const cur = m.get(id) ?? {
      productId: id,
      revenue: 0,
      conversions: 0,
      clicks: 0,
      postCount: 0,
    };
    cur.postCount += 1;
    const perf = p.performance;
    if (perf) {
      cur.revenue += num(perf.revenue);
      cur.conversions += num(perf.conversions);
      cur.clicks += num(perf.clicks) + num(perf.imageClicks);
    }
    m.set(id, cur);
  }
  return m;
}

export function demandScoreFromSignals(s: ProductGrowthSignals | undefined): number | undefined {
  if (!s) return undefined;
  const raw = s.revenue / 400 + s.conversions * 0.15 + s.clicks / 250;
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.min(2, raw);
}
