/**
 * Aggregerte porteføljemålinger.
 */

export type PortfolioCampaignInput = {
  spend: number;
  revenue: number;
};

export function getPortfolioMetrics(campaigns: PortfolioCampaignInput[]): {
  totalSpend: number;
  totalRevenue: number;
  roas: number;
} {
  const totalSpend = campaigns.reduce((s, c) => s + Math.max(0, c.spend), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + Math.max(0, c.revenue), 0);
  return {
    totalSpend,
    totalRevenue,
    roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
  };
}
