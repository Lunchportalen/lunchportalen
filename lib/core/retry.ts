import "server-only";

/**
 * Bounded retries for idempotent read operations. Fails closed on last error.
 * @param times Maks forsøk (1–5), ikke «ekstra retries» etter første.
 */
export async function retry<T>(fn: () => Promise<T>, times = 2): Promise<T> {
  const n = Math.max(1, Math.min(5, Math.floor(times)));
  let last: unknown;
  for (let i = 0; i < n; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i === n - 1) break;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}
