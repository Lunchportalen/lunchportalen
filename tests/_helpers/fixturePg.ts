/**
 * Direct Postgres for integration-test fixtures only.
 * Staging/prod provider tables lack INSERT grants for PostgREST `service_role`;
 * the `postgres` DB role (connection string) is required for seed-style DML.
 */
import pg from "pg";

import { readPostgresFixtureEnv } from "./remoteSupabaseIntegration";

let pool: pg.Pool | null = null;

function createPoolConfig(connectionString: string): pg.PoolConfig {
  let url = connectionString;
  try {
    const u = new URL(connectionString);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    url = u.toString();
  } catch {
    // non-URL connection string
  }
  const parsed = new URL(url);
  const isPooler =
    parsed.port === "6543" || parsed.hostname.includes("pooler.supabase.com");
  return {
    connectionString: url,
    max: 2,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    ...(isPooler ? { prepare: false as const } : {}),
  };
}

export function hasPostgresFixtureEnv(): boolean {
  try {
    readPostgresFixtureEnv();
    return true;
  } catch {
    return false;
  }
}

export function getFixturePgPool(): pg.Pool {
  if (!pool) {
    const { connectionString } = readPostgresFixtureEnv();
    pool = new pg.Pool(createPoolConfig(connectionString));
  }
  return pool;
}

export async function closeFixturePgPool(): Promise<void> {
  if (!pool) return;
  const p = pool;
  pool = null;
  await p.end();
}

let grantsBootstrapped = false;

/**
 * Staging branch may lack PostgREST table GRANTs that prod has (providers patch tables).
 * Apply idempotent grants via postgres role so authenticated+RLS tests can run.
 * Does not alter RLS policies — only table privileges for the `authenticated` role.
 */
export async function ensureIntegrationTestTableGrants(): Promise<void> {
  if (grantsBootstrapped) return;
  const tablesSelect = [
    "providers",
    "provider_memberships",
    "companies",
    "orders",
    "agreements",
    "company_registrations",
    "company_locations",
    "profiles",
    "lifecycle_audit_log",
    "driver_runs",
    "deliveries",
  ] as const;
  // Parallel test files bootstrap concurrently; concurrent GRANTs on the same
  // table race in pg_class ("tuple concurrently updated"). Retry with backoff.
  const grantWithRetry = async (sql: string) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await fixturePgQuery(sql);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt < 5 && msg.includes("tuple concurrently updated")) {
          await new Promise((r) => setTimeout(r, 250 * attempt));
          continue;
        }
        throw e;
      }
    }
  };
  for (const table of tablesSelect) {
    await grantWithRetry(`GRANT SELECT ON public.${table} TO authenticated`);
  }
  await grantWithRetry(`GRANT UPDATE ON public.companies TO authenticated`);
  grantsBootstrapped = true;
}

export async function fixturePgQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<pg.QueryResult<T>> {
  const client = await getFixturePgPool().connect();
  try {
    return await client.query<T>(text, values);
  } finally {
    client.release();
  }
}

/**
 * Run several parameterized statements in ONE transaction on ONE connection.
 * Needed for fixture teardown with `set local session_replication_role`.
 */
export async function fixturePgTransaction(
  statements: Array<{ text: string; values?: unknown[] }>,
): Promise<void> {
  const client = await getFixturePgPool().connect();
  try {
    await client.query("begin");
    for (const s of statements) {
      await client.query(s.text, s.values);
    }
    await client.query("commit");
  } catch (e) {
    try {
      await client.query("rollback");
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }
}
