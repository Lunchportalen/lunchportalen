import "server-only";

/**
 * In-process cache with TTL (single Node instance). Bounded freshness for scale; not durable on serverless cold starts.
 */

type CacheEntry = { value: unknown; expiresAt: number };

const store: Record<string, CacheEntry> = {};

export function setCache(key: string, value: unknown, ttlMs = 60_000): void {
  const ttl = typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 60_000;
  store[key] = { value, expiresAt: Date.now() + ttl };
}

export function getCache<T>(key: string): T | undefined {
  const row = store[key];
  if (!row) return undefined;
  if (Date.now() >= row.expiresAt) {
    delete store[key];
    return undefined;
  }
  return row.value as T;
}
