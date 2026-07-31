#!/usr/bin/env node
/**
 * Revert remote-only staging ledger versions that are absent from git migrations/.
 * Prevents `supabase db push --dry-run` ABORT: "Remote migration versions not found".
 * uigx only, idempotent â€” ledger repair only (no schema rewrite).
 *
 * Versions sourced from staging dry-run repair hint (PR #585 / capacity migrations).
 */
import { spawnSync } from "node:child_process";
import pg from "pg";

const STAGING_REF = "uigxsboqeruxflgzqztl";

/** Remote ledger rows not present as files under supabase/migrations/. */
export const REMOTE_ORPHAN_VERSIONS = [
  "20260717151311",
  "20260717165828",
  "20260717234759",
  "20260717234802",
  "20260717234819",
  "20260717234845",
  "20260718122028",
  "20260718130429",
  "20260718211933",
  "20260718212105",
  "20260718213008",
  "20260718224251",
  "20260718224435",
  // Review-ops intentionally excluded from Norway release / git migrations.
  "20260901120000",
];

export async function repairStagingRemoteOrphanLedger(env = process.env) {
  const url = String(env.STAGING_DATABASE_URL ?? env.DATABASE_URL ?? "").trim();
  if (!url.includes(STAGING_REF)) {
    console.log("REMOTE_ORPHAN_LEDGER_REPAIR_SKIP", "not staging ref");
    return { action: "skip", reason: "not staging ref" };
  }

  function runRepair(version) {
    const r = spawnSync(
      "supabase",
      ["migration", "repair", "--status", "reverted", version, "--db-url", url],
      { encoding: "utf8", shell: process.platform === "win32" },
    );
    if (r.status !== 0) {
      console.error("REMOTE_ORPHAN_LEDGER_REPAIR_FAIL", version, r.stdout, r.stderr);
      throw new Error(`repair failed for ${version}`);
    }
    console.log("REMOTE_ORPHAN_LEDGER_REPAIR_REVERTED", version);
  }

  const normalized = /sslmode=/i.test(url)
    ? url.replace(/sslmode=[^&]+/i, "sslmode=no-verify")
    : `${url}${url.includes("?") ? "&" : "?"}sslmode=no-verify`;

  const client = new pg.Client({ connectionString: normalized, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const { rows } = await client.query(
      `select version from supabase_migrations.schema_migrations where version = any($1::text[])`,
      [REMOTE_ORPHAN_VERSIONS],
    );
    const present = rows.map((r) => String(r.version)).sort();
    if (present.length === 0) {
      console.log(
        "REMOTE_ORPHAN_LEDGER_REPAIR_OK",
        JSON.stringify({ action: "none", reason: "no_orphan_versions" }),
      );
      return { action: "none", reason: "no_orphan_versions" };
    }

    for (const version of present) {
      runRepair(version);
    }

    console.log("REMOTE_ORPHAN_LEDGER_REPAIR_OK", JSON.stringify({ reverted: present }));
    return { action: "reverted", reverted: present };
  } finally {
    await client.end();
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith("repair-staging-remote-orphan-ledger.mjs") ||
    process.argv[1].includes("repair-staging-remote-orphan-ledger"));

if (isMain) {
  repairStagingRemoteOrphanLedger().catch((err) => {
    console.error("::error::remote orphan ledger repair failed:", err);
    process.exit(1);
  });
}
