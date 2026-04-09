import "server-only";

import { getRedis } from "@/lib/infra/redis";

/**
 * Read-through JSON cache (Redis). Returns null on miss or Redis unavailable (fail-closed).
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = await getRedis();
  if (!r) return null;
  try {
    const v = await r.get(key);
    if (v == null || v === "") return null;
    return JSON.parse(v) as T;
  } catch (e) {
    console.error("[redis_cache_get]", key, e instanceof Error ? e.message : String(e));
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 10): Promise<boolean> {
  const r = await getRedis();
  if (!r) return false;
  const ttl = Math.max(1, Math.min(86_400, Math.floor(ttlSeconds)));
  try {
    await r.set(key, JSON.stringify(value), { EX: ttl });
    return true;
  } catch (e) {
    console.error("[redis_cache_set]", key, e instanceof Error ? e.message : String(e));
    return false;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch {
    /* ignore */
  }
}
