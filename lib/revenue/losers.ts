import type { RevenuePostModel } from "@/lib/revenue/model";

/** Leads uten konvertering til ordre (data-drevet signal, ikke dom). */
export function findLosers(posts: RevenuePostModel[]): RevenuePostModel[] {
  const list = Array.isArray(posts) ? posts : [];
  return list.filter((p) => p.leads > 0 && p.orders === 0);
}
