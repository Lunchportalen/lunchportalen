/**
 * Deterministic linear delta over the last 5 points for `key`.
 */
export function computeTrend(series: Record<string, unknown>[], key: string): number {
  if (series.length < 5) return 0;

  const last = series.slice(-5);
  const firstVal = Number(last[0]?.[key] ?? 0);
  const lastVal = Number(last[last.length - 1]?.[key] ?? 0);

  return lastVal - firstVal;
}
