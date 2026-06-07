/**
 * Shared postdeploy gate helpers (importable by tests).
 */

/** HTTP statuses retried during deploy / warm-up windows (fail-closed after budget). */
export function isTransient(result) {
  return (
    result.status === 0 ||
    result.status === 403 ||
    result.status === 404 ||
    result.status === 408 ||
    result.status === 425 ||
    result.status === 429 ||
    result.status === 500 ||
    result.status === 502 ||
    result.status === 503 ||
    result.status === 504
  );
}

/** Default retry budget: 12 attempts × 15s delay ≈ 3 min warm-up window (+ fetch time). */
export const DEFAULT_RETRIES = 12;
export const DEFAULT_RETRY_DELAY_MS = 15_000;
export const DEFAULT_TIMEOUT_MS = 15_000;
