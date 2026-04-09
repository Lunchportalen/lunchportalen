/**
 * Brutto profit-modell (enkel, forklarbar) — ikke inkl. COGS utover spend.
 */

export type ProfitInput = {
  revenue: number;
  spend: number;
};

export function calculateProfit(data: ProfitInput): number {
  return data.revenue - data.spend;
}

export function calculateMargin(data: ProfitInput): number {
  if (!data.revenue) return 0;
  return (data.revenue - data.spend) / data.revenue;
}
