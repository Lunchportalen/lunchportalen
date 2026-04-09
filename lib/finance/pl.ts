/**
 * P&L — ren regning, ingen I/O (deterministisk).
 */

export type PL = {
  revenue: number;
  costOfGoods: number;
  adSpend: number;
  grossProfit: number;
  netProfit: number;
  /** Nettomargin på omsetning: netProfit / revenue (0 hvis revenue ≤ 0). */
  margin: number;
};

export type PLInput = {
  revenue?: number;
  costOfGoods?: number;
  adSpend?: number;
};

function finiteNonNeg(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

export function calculatePL(data: PLInput): PL {
  const revenue = finiteNonNeg(data.revenue);
  const cost = finiteNonNeg(data.costOfGoods);
  const ads = finiteNonNeg(data.adSpend);

  const grossProfit = revenue - cost;
  const netProfit = grossProfit - ads;

  return {
    revenue,
    costOfGoods: cost,
    adSpend: ads,
    grossProfit,
    netProfit,
    margin: revenue > 0 ? netProfit / revenue : 0,
  };
}
