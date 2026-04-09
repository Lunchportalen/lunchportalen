import type { PerformanceMetrics } from "@/lib/growth/performance";

export type VariantScoreRow = {
  variantId: string;
  label: string | null;
  socialPostId: string;
  metrics: PerformanceMetrics;
  funnel: { clicks: number; leads: number; orders: number; revenue: number };
};

/**
 * Velger vinner etter høyest revenuePerClick; ved likhet: høyest variantId (deterministisk tie-break).
 */
export function pickWinner(variants: VariantScoreRow[]): VariantScoreRow | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const sorted = [...variants].sort((a, b) => {
    const d = b.metrics.revenuePerClick - a.metrics.revenuePerClick;
    if (d !== 0) return d;
    return b.variantId.localeCompare(a.variantId);
  });
  const top = sorted[0];
  if (!top) return null;
  if (
    top.funnel.clicks === 0 &&
    top.funnel.leads === 0 &&
    top.funnel.orders === 0 &&
    top.funnel.revenue === 0
  ) {
    return null;
  }
  return top;
}
