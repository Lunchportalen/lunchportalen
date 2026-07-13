/**
 * RLS golden parity: sammenlign prod/lokal Postgres med tests/rls/golden-rls-snapshot.json (v2).
 *
 * Krever direkte Postgres. Miljø:
 *   SUPABASE_POSTGRES_URL eller DATABASE_URL
 *
 * Opt-in: default vitest.config ekskluderer tests/rls/** — kjør med vitest.rls.config.ts.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import {
  SQL_POLICIES,
  SQL_PRIVATE_FUNCTIONS,
  SQL_RLS_ENABLED_TABLES,
  SQL_POSTGRES_VERSION,
  buildGoldenPayload,
  createSupabasePoolConfig,
} from "../../scripts/rls/golden-snapshot-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, "..", "..", ".env.local") });
dotenv.config({ path: join(__dirname, "..", "..", ".env") });

type GoldenV2 = {
  version: number;
  generated_at: string;
  project_ref: string;
  postgres_version: string;
  policies: unknown[];
  private_functions: unknown[];
  rls_enabled_tables: unknown[];
};

function goldenPath() {
  return join(__dirname, "golden-rls-snapshot.json");
}

function loadGolden(): GoldenV2 {
  return JSON.parse(readFileSync(goldenPath(), "utf8")) as GoldenV2;
}

function dbUrl(): string | null {
  const u = process.env.SUPABASE_POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  return u.trim() ? u.trim() : null;
}

const url = dbUrl();
const describeDb = url ? describe : describe.skip;

describeDb("RLS migration parity (golden snapshot v2)", () => {
  let pool: pg.Pool;
  const golden = loadGolden();

  beforeAll(() => {
    pool = new pg.Pool(createSupabasePoolConfig(url!, 2));
  });

  afterAll(async () => {
    await pool.end();
  });

  test("golden v2 matcher databasen (policies, private_functions, rls_enabled_tables + meta)", async () => {
    expect(golden.version).toBe(2);

    const { rows: ver } = await pool.query(SQL_POSTGRES_VERSION);
    const postgres_version = ver[0]?.postgres_version as string;

    const [{ rows: policyRows }, { rows: functionRows }, { rows: rlsRows }] =
      await Promise.all([
        pool.query(SQL_POLICIES),
        pool.query(SQL_PRIVATE_FUNCTIONS),
        pool.query(SQL_RLS_ENABLED_TABLES),
      ]);

    const live = buildGoldenPayload({
      project_ref: golden.project_ref,
      postgres_version,
      policyRows,
      functionRows,
      rlsRows,
    });

    expect(live.project_ref).toEqual(golden.project_ref);
    // Compare the Postgres version number only. The full version() string embeds
    // the compiler build (gcc x.y.z), which drifts between staging/prod infra
    // rebuilds without any schema/RLS meaning and made this gate fail on noise.
    const versionNumber = (s: string) => s.match(/^PostgreSQL \S+/)?.[0] ?? s;
    expect(versionNumber(live.postgres_version)).toEqual(versionNumber(golden.postgres_version));
    expect(live.policies).toEqual(golden.policies);
    expect(live.private_functions).toEqual(golden.private_functions);
    expect(live.rls_enabled_tables).toEqual(golden.rls_enabled_tables);
  });
});
