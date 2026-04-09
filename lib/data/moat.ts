export type MoatDatum = { value: number };

/**
 * Kun aggregerte tall — ingen rå persondata.
 */
export function buildMarketInsights(data: MoatDatum[]): { totalOrders: number; avgValue: number } {
  const list = Array.isArray(data) ? data : [];
  const totalOrders = list.length;
  if (totalOrders === 0) {
    return { totalOrders: 0, avgValue: 0 };
  }
  const sum = list.reduce((s, d) => s + (Number.isFinite(d.value) ? d.value : 0), 0);
  return {
    totalOrders,
    avgValue: sum / totalOrders,
  };
}
