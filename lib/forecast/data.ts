/**
 * Rå salgspunkter for deterministisk etterspørselsanalyse (ingen ML).
 */

export type SalesPoint = {
  date: string; // YYYY-MM-DD
  productId: string;
  units: number;
};

export function groupByProduct(points: SalesPoint[]): Map<string, SalesPoint[]> {
  const map = new Map<string, SalesPoint[]>();
  for (const p of points) {
    const arr = map.get(p.productId) ?? [];
    arr.push(p);
    map.set(p.productId, arr);
  }
  return map;
}
