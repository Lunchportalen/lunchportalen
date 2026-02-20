import "server-only";

export type CachedAuthClaims = {
  role: string | null;
  company_id: string | null;
  location_id: string | null;
  status: string | null;
  updated_at: string | null;
};

type MemoryRecord = {
  value: CachedAuthClaims;
  expiresAt: number;
};

const DEV_LRU_MAX = 5000;
const CACHE_PREFIX = "lp:auth:claims:";

const memoryCache = new Map<string, MemoryRecord>();

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function parseTtlSeconds() {
  const raw = Number.parseInt(safeStr(process.env.LP_AUTH_CACHE_TTL_SECONDS) || "", 10);
  if (!Number.isFinite(raw) || raw <= 0) return 600;
  return raw;
}

function ttlSeconds() {
  return parseTtlSeconds();
}

function nowMs() {
  return Date.now();
}

function shouldUseMemoryCache() {
  return process.env.NODE_ENV !== "production";
}

function redisBaseUrl() {
  const raw = safeStr(process.env.LP_REDIS_URL);
  if (!raw) return "";
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) return "";
  return raw.replace(/\/+$/, "");
}

function redisAuthHeaders() {
  const token = safeStr(process.env.LP_REDIS_TOKEN);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${userId}`;
}

function normalizeClaims(raw: any): CachedAuthClaims | null {
  if (!raw || typeof raw !== "object") return null;

  return {
    role: safeStr(raw.role) || null,
    company_id: safeStr(raw.company_id) || null,
    location_id: safeStr(raw.location_id) || null,
    status: safeStr(raw.status).toLowerCase() || null,
    updated_at: safeStr(raw.updated_at) || null,
  };
}

function readMemory(key: string): CachedAuthClaims | null {
  if (!shouldUseMemoryCache()) return null;

  const item = memoryCache.get(key);
  if (!item) return null;

  if (item.expiresAt <= nowMs()) {
    memoryCache.delete(key);
    return null;
  }

  memoryCache.delete(key);
  memoryCache.set(key, item);
  return item.value;
}

function writeMemory(key: string, value: CachedAuthClaims) {
  if (!shouldUseMemoryCache()) return;

  memoryCache.set(key, {
    value,
    expiresAt: nowMs() + ttlSeconds() * 1000,
  });

  while (memoryCache.size > DEV_LRU_MAX) {
    const oldest = memoryCache.keys().next().value;
    if (!oldest) break;
    memoryCache.delete(oldest);
  }
}

async function readRedis(key: string): Promise<CachedAuthClaims | null> {
  const base = redisBaseUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
      method: "GET",
      headers: {
        ...redisAuthHeaders(),
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json = await res.json().catch(() => null);
    const payload = (json as any)?.result;

    if (!payload) return null;

    if (typeof payload === "string") {
      const parsed = JSON.parse(payload);
      return normalizeClaims(parsed);
    }

    return normalizeClaims(payload);
  } catch {
    return null;
  }
}

async function writeRedis(key: string, value: CachedAuthClaims) {
  const base = redisBaseUrl();
  if (!base) return;

  try {
    const serialized = JSON.stringify(value);
    await fetch(`${base}/setex/${encodeURIComponent(key)}/${ttlSeconds()}/${encodeURIComponent(serialized)}`, {
      method: "POST",
      headers: {
        ...redisAuthHeaders(),
      },
      cache: "no-store",
    });
  } catch {
    return;
  }
}

export async function getAuthCache(userId: string): Promise<CachedAuthClaims | null> {
  const uid = safeStr(userId);
  if (!uid) return null;

  const key = cacheKey(uid);

  const memory = readMemory(key);
  if (memory) return memory;

  const redis = await readRedis(key);
  if (!redis) return null;

  writeMemory(key, redis);
  return redis;
}

export async function setAuthCache(userId: string, claims: CachedAuthClaims): Promise<void> {
  const uid = safeStr(userId);
  if (!uid) return;

  const normalized = normalizeClaims(claims);
  if (!normalized) return;

  const key = cacheKey(uid);

  writeMemory(key, normalized);
  await writeRedis(key, normalized);
}
