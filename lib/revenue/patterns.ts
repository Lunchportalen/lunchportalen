import type { RevenuePostModel } from "@/lib/revenue/model";

export type RevenuePattern = {
  hook: string;
  revenue: number;
  postId: string;
};

export function extractRevenuePatterns(winners: RevenuePostModel[]): RevenuePattern[] {
  const list = Array.isArray(winners) ? winners : [];
  return list.map((w) => ({
    postId: w.postId,
    hook: (w.text ?? "").trim().slice(0, 60),
    revenue: w.revenue,
  }));
}
