import "server-only";

/**
 * Enkel retry med fast antall forsøk. Deterministisk rekkefølge (ingen jitter).
 */
export async function retry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  const max = Math.max(0, Math.floor(retries));
  let lastError: unknown;

  for (let i = 0; i <= max; i += 1) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError;
}
