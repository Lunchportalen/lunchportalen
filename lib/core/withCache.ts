import "server-only";

import { getCache, setCache } from "@/lib/core/cache";

export type WithCacheOpts = {
  /** Default 60s */
  ttlMs?: number;
};

/**
 * Memoizes async work per key with TTL. Fail-closed: propagates fn() errors.
 */
export async function withCache<T>(key: string, fn: () => Promise<T>, opts?: WithCacheOpts): Promise<T> {
  const ttlMs = opts?.ttlMs ?? 60_000;
  const hit = getCache<T>(key);
  if (hit !== undefined) return hit;
  const result = await fn();
  setCache(key, result, ttlMs);
  return result;
}
