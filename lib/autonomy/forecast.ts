/**
 * Simple moving average over the last 5 points for `key`.
 */
export function forecastNext(series: Record<string, unknown>[], key: string): number | null {
  if (series.length < 5) return null;

  const last = series.slice(-5);
  const sum = last.reduce((acc, x) => acc + Number(x[key] ?? 0), 0);
  return sum / last.length;
}
