#!/usr/bin/env node
/**
 * Apply WS-3 menu week opening backfill on staging when ledger skipped 20260620183000
 * but later migrations were applied (requires --include-all once). uigx only, idempotent.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";

const STAGING_REF = "uigxsboqeruxflgzqztl";
const BACKFILL_VERSION = "20260620183000";

const url = String(process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL ?? "").trim();
if (!url.includes(STAGING_REF)) {
  console.log("MENU_WEEK_LEDGER_REPAIR_SKIP", "not staging ref");
  process.exit(0);
}

const normalized = /sslmode=/i.test(url)
  ? url.replace(/sslmode=[^&]+/i, "sslmode=no-verify")
  : `${url}${url.includes("?") ? "&" : "?"}sslmode=no-verify`;

const client = new pg.Client({ connectionString: normalized, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const { rows } = await client.query(
    `select version from supabase_migrations.schema_migrations where version = $1`,
    [BACKFILL_VERSION],
  );
  if (rows.length > 0) {
    console.log("MENU_WEEK_LEDGER_REPAIR_OK", JSON.stringify({ action: "none", reason: "already_applied" }));
    process.exit(0);
  }

  console.log("MENU_WEEK_LEDGER_REPAIR", "applying backfill via db push --include-all");
  const r = spawnSync(
    "supabase",
    ["db", "push", "--include-all", "--db-url", url, "--yes"],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  if (r.status !== 0) {
    console.error("MENU_WEEK_LEDGER_REPAIR_FAIL", r.status);
    process.exit(1);
  }

  const verify = await client.query(
    `select version from supabase_migrations.schema_migrations where version = $1`,
    [BACKFILL_VERSION],
  );
  if (verify.rows.length === 0) {
    console.error("MENU_WEEK_LEDGER_REPAIR_FAIL", "version still missing after push");
    process.exit(1);
  }

  console.log("MENU_WEEK_LEDGER_REPAIR_OK", JSON.stringify({ applied: BACKFILL_VERSION }));
} finally {
  await client.end();
}
