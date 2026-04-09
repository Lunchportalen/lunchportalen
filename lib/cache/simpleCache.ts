import "server-only";

/**
 * In-process TTL cache (per Node instance). For horizontal scale, TTL is short — each replica has its own map.
 * Expiry uses timestamps (no per-key setTimeout storms).
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

const MAX_KEYS = 10_000;

function pruneIfNeeded(): void {
  if (store.size <= MAX_KEYS) return;
  const now = Date.now();
  for (const [k, e] of store) {
    if (e.expiresAt <= now) store.delete(k);
  }
  if (store.size > MAX_KEYS) {
    const keys = [...store.keys()].slice(0, Math.floor(store.size / 2));
    for (const k of keys) store.delete(k);
  }
}

export function getCache<T>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs = 5000): void {
  pruneIfNeeded();
  store.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlMs) });
}

export function deleteCache(key: string): void {
  store.delete(key);
}

/** Observability: current key count (includes unexpired entries). */
export function cacheKeyCount(): number {
  return store.size;
}
