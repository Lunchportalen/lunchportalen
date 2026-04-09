import "server-only";

/**
 * Race promise against timeout. Deterministic rejection shape for callers.
 */
export async function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  const n = typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : 5000;
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        t = setTimeout(() => {
          const err = new Error("TIMEOUT");
          (err as Error & { code?: string }).code = "TIMEOUT";
          reject(err);
        }, n);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

/**
 * Timeout med deterministisk fallback (graceful degradation).
 */
export async function withTimeoutSafe<T>(promise: Promise<T>, fallback: T, ms?: number): Promise<T> {
  try {
    return await withTimeout(promise, ms);
  } catch (e) {
    console.error("[TIMEOUT_FALLBACK]", e instanceof Error ? e.message : String(e));
    return fallback;
  }
}
