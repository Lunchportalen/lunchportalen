/**
 * Generer tests/rls/golden-rls-snapshot.json fra Postgres.
 *
 * URL priority: RLS_DRIFT_DATABASE_URL > DATABASE_URL > SUPABASE_POSTGRES_URL
 * Pinned ref: RLS_DRIFT_EXPECTED_REF (default hkpokyapzarefrgqzkos)
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import {
  SQL_POSTGRES_VERSION,
  SQL_POLICIES,
  SQL_PRIVATE_FUNCTIONS,
  SQL_RLS_ENABLED_TABLES,
  buildGoldenPayload,
  createSupabasePoolConfig,
  resolveRlsDatabaseUrl,
  assertRlsDriftDbIdentity,
} from "./golden-snapshot-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const outPath = join(root, "tests", "rls", "golden-rls-snapshot.json");

dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, ".env") });

async function main() {
  const url = resolveRlsDatabaseUrl();
  if (!url) {
    console.error(
      "Mangler RLS_DRIFT_DATABASE_URL, DATABASE_URL eller SUPABASE_POSTGRES_URL.",
    );
    process.exit(1);
  }

  const identity = assertRlsDriftDbIdentity({ databaseUrl: url });
  if (!identity.ok) {
    console.error(identity.error);
    process.exit(1);
  }

  const pool = new pg.Pool(createSupabasePoolConfig(url, 2));
  try {
    const { rows: ver } = await pool.query(SQL_POSTGRES_VERSION);
    const postgres_version = ver[0]?.postgres_version;
    if (!postgres_version) throw new Error("version()-spørring returnerte ingen rad");

    const [{ rows: policyRows }, { rows: functionRows }, { rows: rlsRows }] =
      await Promise.all([
        pool.query(SQL_POLICIES),
        pool.query(SQL_PRIVATE_FUNCTIONS),
        pool.query(SQL_RLS_ENABLED_TABLES),
      ]);

    const payload = buildGoldenPayload({
      project_ref: identity.connectedRef,
      postgres_version,
      policyRows,
      functionRows,
      rlsRows,
    });

    writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    const np = payload.policies.length;
    const nf = payload.private_functions.length;
    const nt = payload.rls_enabled_tables.length;
    console.log(
      `RLS golden snapshot: project_ref=${identity.connectedRef} (verified expected ${identity.expectedRef})`,
    );
    console.log(`Snapshot generert: ${np} policies, ${nf} functions, ${nt} tables`);
    console.log(`Skrev: ${outPath}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

await main();
