import type { RevenuePostModel } from "@/lib/revenue/model";

export function findWinners(posts: RevenuePostModel[]): RevenuePostModel[] {
  const list = Array.isArray(posts) ? posts : [];
  return list.filter((p) => p.revenue > 0).sort((a, b) => b.revenue - a.revenue);
}
