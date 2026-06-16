#!/usr/bin/env node
/**
 * Reconcile staging ledger after provider-after-cutoff rename:
 *   repo/prod: 20260616110410_lp_order_advance_status_provider_after_cutoff
 *   staging (PR #214 apply): 20260717120000 (orphaned after rename)
 * uigx only, idempotent — ledger repair only, no SQL/runtime changes.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";

const STAGING_REF = "uigxsboqeruxflgzqztl";
const ORPHAN_VERSION = "20260717120000";
const CANONICAL_VERSION = "20260616110410";

const url = String(process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL ?? "").trim();
if (!url.includes(STAGING_REF)) {
  console.log("PROVIDER_CUTOFF_LEDGER_REPAIR_SKIP", "not staging ref");
  process.exit(0);
}

function runRepair(status, version) {
  const r = spawnSync(
    "supabase",
    ["migration", "repair", "--status", status, version, "--db-url", url],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  if (r.status !== 0) {
    console.error("PROVIDER_CUTOFF_LEDGER_REPAIR_FAIL", version, status, r.stdout, r.stderr);
    process.exit(1);
  }
  console.log("PROVIDER_CUTOFF_LEDGER_REPAIR", status, version);
}

const normalized = /sslmode=/i.test(url)
  ? url.replace(/sslmode=[^&]+/i, "sslmode=no-verify")
  : `${url}${url.includes("?") ? "&" : "?"}sslmode=no-verify`;

const client = new pg.Client({ connectionString: normalized, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const { rows } = await client.query(
    `select version from supabase_migrations.schema_migrations where version = any($1::text[])`,
    [[ORPHAN_VERSION, CANONICAL_VERSION]],
  );
  const present = new Set(rows.map((r) => String(r.version)));
  const actions = [];

  if (present.has(ORPHAN_VERSION)) {
    runRepair("reverted", ORPHAN_VERSION);
    actions.push({ reverted: ORPHAN_VERSION });
  }

  if (!present.has(CANONICAL_VERSION)) {
    const { rows: fnRows } = await client.query(`
      select pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'lp_order_advance_status'
        and pg_get_function_identity_arguments(p.oid) = 'p_order_id uuid, p_target_status text, p_note text'
    `);
    const def = String(fnRows[0]?.def ?? "");
    if (def.includes("app.batch_derived_advance")) {
      runRepair("applied", CANONICAL_VERSION);
      actions.push({ applied: CANONICAL_VERSION, reason: "function_already_matches" });
    } else {
      console.log(
        "PROVIDER_CUTOFF_LEDGER_REPAIR_SKIP",
        JSON.stringify({ reason: "canonical_not_applied_function_missing_guc" }),
      );
    }
  }

  if (actions.length === 0) {
    console.log("PROVIDER_CUTOFF_LEDGER_REPAIR_OK", JSON.stringify({ action: "none" }));
  } else {
    console.log("PROVIDER_CUTOFF_LEDGER_REPAIR_OK", JSON.stringify({ actions }));
  }
} finally {
  await client.end();
}
