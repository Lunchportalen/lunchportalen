/**
 * Deterministiske KPI-er fra aggregerte tall (ingen gjetting).
 * Merk: «ctr» her er lead-rate fra klikk (leads/klikk), ikke annonse-CTR.
 */
export type FunnelCounts = {
  clicks: number;
  leads: number;
  orders: number;
  revenue: number;
};

export type PerformanceMetrics = {
  /** leads / clicks */
  ctr: number;
  /** orders / leads */
  conversion: number;
  revenuePerClick: number;
};

export function computePerformance(data: FunnelCounts): PerformanceMetrics {
  const clicks = Math.max(0, Math.floor(Number(data.clicks) || 0));
  const leads = Math.max(0, Math.floor(Number(data.leads) || 0));
  const orders = Math.max(0, Math.floor(Number(data.orders) || 0));
  const revenue = typeof data.revenue === "number" && Number.isFinite(data.revenue) ? data.revenue : 0;

  return {
    ctr: clicks > 0 ? leads / clicks : 0,
    conversion: leads > 0 ? orders / leads : 0,
    revenuePerClick: clicks > 0 ? revenue / clicks : 0,
  };
}
