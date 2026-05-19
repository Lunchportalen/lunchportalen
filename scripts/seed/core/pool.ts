/**
 * Postgres pool for seed scripts.
 *
 * Default: DATABASE_URL (Supavisor transaction mode, port 6543, IPv4 pooler host).
 * Opt-in direct: SEED_USE_DIRECT=true → POSTGRES_URL_NON_POOLING (+ IPv6 resolve6 shim).
 */
import dns from "node:dns/promises";
import pg from "pg";

import type { SeedEnv } from "./env.js";

const DEFAULT_POOL_MAX = 10;

function poolMaxConnections(): number {
  const raw = (process.env.SEED_POOL_MAX ?? "").trim();
  if (!raw) return DEFAULT_POOL_MAX;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 50) {
    throw new Error(`REFUSE_INVALID_SEED_POOL_MAX value=${raw}`);
  }
  return n;
}

let pool: pg.Pool | null = null;
let poolInit: Promise<pg.Pool> | null = null;

function useDirectConnection(): boolean {
  const v = (process.env.SEED_USE_DIRECT ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function resolveIpv6ConnectionString(connectionString: string): Promise<string> {
  const url = new URL(connectionString);
  const host = url.hostname;
  if (!host || host.startsWith("[")) {
    return connectionString;
  }

  try {
    const v6 = await dns.resolve6(host);
    const ip = v6[0];
    if (ip) {
      url.hostname = `[${ip}]`;
      return url.toString();
    }
  } catch {
    // fall through
  }

  return connectionString;
}

function pickConnectionString(env: SeedEnv): string {
  if (useDirectConnection()) {
    return env.postgresUrlNonPooling;
  }
  return env.databaseUrl;
}

async function createPool(env: SeedEnv): Promise<pg.Pool> {
  const direct = useDirectConnection();
  let connectionString = pickConnectionString(env);

  if (direct) {
    connectionString = await resolveIpv6ConnectionString(connectionString);
  }

  const url = new URL(connectionString);
  const isPooler =
    !direct &&
    (url.port === "6543" || url.hostname.includes("pooler.supabase.com"));

  return new pg.Pool({
    connectionString,
    max: poolMaxConnections(),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
    ...(isPooler ? { prepare: false as const } : {}),
  });
}

export async function getPool(env: SeedEnv): Promise<pg.Pool> {
  if (pool) return pool;
  if (!poolInit) {
    poolInit = createPool(env).then((p) => {
      pool = p;
      return p;
    });
  }
  return poolInit;
}

export function poolConnectionMode(): "pooler" | "direct" {
  return useDirectConnection() ? "direct" : "pooler";
}

export async function closePool(): Promise<void> {
  poolInit = null;
  if (!pool) return;
  const p = pool;
  pool = null;
  await p.end();
}
