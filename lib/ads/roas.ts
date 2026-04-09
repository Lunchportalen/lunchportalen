/**
 * ROAS — omsetning per annonsekroning (forklarbar, deterministisk).
 */

export type RoasInput = {
  spend: number;
  revenue: number;
};

export function calculateROAS(data: RoasInput): number {
  if (!data.spend || data.spend === 0) return 0;
  return data.revenue / data.spend;
}
