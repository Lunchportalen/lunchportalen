#!/usr/bin/env node
/**
 * READ-ONLY: Postgres vs tests/rls/golden-rls-snapshot.json (v2).
 * Exit: 0 = match, 1 = drift, 2 = config/connection.
 *
 * Env: SUPABASE_POSTGRES_URL eller DATABASE_URL (samme prioritet som migrationParity / rls:snapshot).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
} from "./rls/golden-snapshot-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const GOLDEN_REL = join(root, "tests", "rls", "golden-rls-snapshot.json");

dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, ".env") });

const STATEMENT_TIMEOUT_MS = 8000;

function checkedAt() {
  return new Date().toISOString();
}

function resolveDbUrl() {
  const supa = (process.env.SUPABASE_POSTGRES_URL ?? "").trim();
  const db = (process.env.DATABASE_URL ?? "").trim();
  return supa ? supa : db ? db : "";
}

function loadGolden() {
  const raw = readFileSync(GOLDEN_REL, "utf8");
  return JSON.parse(raw);
}

function printReport(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function sliceDiff(label, goldenArr, liveArr) {
  const glen = goldenArr.length;
  const llen = liveArr.length;
  if (glen !== llen) {
    return { kind: "count", golden: glen, live: llen };
  }
  for (let i = 0; i < glen; i++) {
    const gs = JSON.stringify(goldenArr[i]);
    const ls = JSON.stringify(liveArr[i]);
    if (gs !== ls) {
      return { kind: "index", index: i, golden: goldenArr[i], live: liveArr[i] };
    }
  }
  return null;
}

async function mainAsync() {
  const urlRaw = resolveDbUrl();
  if (!urlRaw) {
    printReport({
      ok: false,
      checkedAt: checkedAt(),
      error: "MISSING_DATABASE_URL",
      message:
        "Sett SUPABASE_POSTGRES_URL eller DATABASE_URL. Legg inn som GitHub secret for scheduled drift-sjekk.",
    });
    return 2;
  }

  let golden;
  try {
    golden = loadGolden();
  } catch (e) {
    printReport({
      ok: false,
      checkedAt: checkedAt(),
      error: "GOLDEN_READ_FAILED",
      message: String(e?.message ?? e),
    });
    return 2;
  }

  if (golden.version !== 2) {
    printReport({
      ok: false,
      checkedAt: checkedAt(),
      error: "GOLDEN_VERSION",
      message: `Forventet golden.version === 2, fikk ${golden.version}`,
    });
    return 2;
  }

  const pool = new pg.Pool(createSupabasePoolConfig(urlRaw, 1));

  try {
    const client = await pool.connect();
    try {
      await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);

      const { rows: ver } = await client.query(SQL_POSTGRES_VERSION);
      const postgres_version = ver[0]?.postgres_version;
      if (!postgres_version) {
        printReport({
          ok: false,
          checkedAt: checkedAt(),
          error: "VERSION_QUERY_EMPTY",
          message: "SELECT version() returnerte ingen rad",
        });
        return 2;
      }

      const { rows: policyRows } = await client.query(SQL_POLICIES);
      const { rows: functionRows } = await client.query(SQL_PRIVATE_FUNCTIONS);
      const { rows: rlsRows } = await client.query(SQL_RLS_ENABLED_TABLES);

      const live = buildGoldenPayload({
        project_ref: golden.project_ref,
        postgres_version,
        policyRows,
        functionRows,
        rlsRows,
      });

      const metaOk =
        live.project_ref === golden.project_ref &&
        live.postgres_version === golden.postgres_version;

      const policyDiff = sliceDiff("policies", golden.policies, live.policies);
      const fnDiff = sliceDiff(
        "private_functions",
        golden.private_functions,
        live.private_functions,
      );
      const rlsDiff = sliceDiff(
        "rls_enabled_tables",
        golden.rls_enabled_tables,
        live.rls_enabled_tables,
      );

      const ok = metaOk && !policyDiff && !fnDiff && !rlsDiff;

      const report = {
        ok,
        checkedAt: checkedAt(),
        counts: {
          policies: { golden: golden.policies.length, live: live.policies.length },
          private_functions: {
            golden: golden.private_functions.length,
            live: live.private_functions.length,
          },
          rls_enabled_tables: {
            golden: golden.rls_enabled_tables.length,
            live: live.rls_enabled_tables.length,
          },
        },
        meta: {
          match: metaOk,
          project_ref: { golden: golden.project_ref, live: live.project_ref },
          postgres_version: { golden: golden.postgres_version, live: live.postgres_version },
        },
        drift: {
          policies: policyDiff,
          private_functions: fnDiff,
          rls_enabled_tables: rlsDiff,
        },
      };

      printReport(report);
      return ok ? 0 : 1;
    } finally {
      client.release();
    }
  } catch (e) {
    printReport({
      ok: false,
      checkedAt: checkedAt(),
      error: "DATABASE_ERROR",
      message: String(e?.message ?? e),
    });
    return 2;
  } finally {
    await pool.end();
  }
}

function main() {
  mainAsync()
    .then((code) => process.exit(code))
    .catch((e) => {
      printReport({
        ok: false,
        checkedAt: checkedAt(),
        error: "UNEXPECTED_ERROR",
        message: String(e?.message ?? e),
      });
      process.exit(2);
    });
}

main();
