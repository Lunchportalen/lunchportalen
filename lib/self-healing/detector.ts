export type LogLike = {
  error?: boolean;
  [key: string]: unknown;
};

/**
 * Deterministic anomaly filter — does not mutate inputs.
 */
export function detectAnomaly(logs: LogLike[]): LogLike[] {
  const list = Array.isArray(logs) ? logs : [];
  return list.filter((l) => l && l.error === true);
}
