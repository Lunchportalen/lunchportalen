/**
 * Generer tests/rls/golden-rls-snapshot.json fra Postgres (DATABASE_URL / SUPABASE_POSTGRES_URL).
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
} from "./golden-snapshot-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const outPath = join(root, "tests", "rls", "golden-rls-snapshot.json");

dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, ".env") });

function dbUrl() {
  const u = process.env.SUPABASE_POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  return u.trim() || null;
}

const DEFAULT_PROJECT_REF = "hkpokyapzarefrgqzkos";

async function main() {
  const url = dbUrl();
  if (!url) {
    console.error(
      "Mangler SUPABASE_POSTGRES_URL eller DATABASE_URL (sett i miljø eller .env / .env.local).",
    );
    process.exit(1);
  }

  const projectRef = (process.env.RLS_GOLDEN_PROJECT_REF ?? DEFAULT_PROJECT_REF).trim();

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
      project_ref: projectRef,
      postgres_version,
      policyRows,
      functionRows,
      rlsRows,
    });

    writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    const np = payload.policies.length;
    const nf = payload.private_functions.length;
    const nt = payload.rls_enabled_tables.length;
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
