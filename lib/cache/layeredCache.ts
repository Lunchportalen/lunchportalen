import "server-only";

import { cacheGet as redisGet, cacheSet as redisSet } from "@/lib/cache/redisCache";
import { getCache, setCache } from "@/lib/cache/simpleCache";

/**
 * L2 Redis (shared across replicas) + L1 in-process (`simpleCache`).
 * Miss on both → compute; fail-closed on Redis errors (falls back to L1 only).
 */
export async function layeredGet<T>(key: string): Promise<T | null> {
  const r = await redisGet<T>(key);
  if (r != null) return r;
  return getCache<T>(key) ?? null;
}

export async function layeredSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  const ttl = Math.max(1, Math.floor(ttlMs));
  const sec = Math.max(1, Math.min(86_400, Math.ceil(ttl / 1000)));
  await redisSet(key, value, sec);
  setCache(key, value, ttl);
}
