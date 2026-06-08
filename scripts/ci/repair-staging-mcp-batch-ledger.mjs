#!/usr/bin/env node
/**
 * Revert MCP-applied staging ledger entries (not in git). uigx only, idempotent.
 * Run in Supabase Migrate workflow before db push dry-run.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";

const STAGING_REF = "uigxsboqeruxflgzqztl";
const MCP_DRIFT_VERSIONS = ["20260608115126", "20260608115315", "20260608115349"];

const url = String(process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL ?? "").trim();
if (!url.includes(STAGING_REF)) {
  console.log("LEDGER_REPAIR_SKIP", "not staging ref");
  process.exit(0);
}

const normalized = /sslmode=/i.test(url)
  ? url.replace(/sslmode=[^&]+/i, "sslmode=no-verify")
  : `${url}${url.includes("?") ? "&" : "?"}sslmode=no-verify`;

const client = new pg.Client({ connectionString: normalized, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const { rows } = await client.query(
    `select version from supabase_migrations.schema_migrations where version = any($1::text[])`,
    [MCP_DRIFT_VERSIONS],
  );
  const present = rows.map((r) => String(r.version));
  if (present.length === 0) {
    console.log("LEDGER_REPAIR_OK", JSON.stringify({ action: "none", reason: "no_mcp_drift_versions" }));
    process.exit(0);
  }

  for (const version of present) {
    const r = spawnSync(
      "supabase",
      ["migration", "repair", "--status", "reverted", version, "--db-url", url],
      { encoding: "utf8", shell: process.platform === "win32" },
    );
    if (r.status !== 0) {
      console.error("LEDGER_REPAIR_FAIL", version, r.stdout, r.stderr);
      process.exit(1);
    }
    console.log("LEDGER_REPAIR_REVERTED", version);
  }

  console.log("LEDGER_REPAIR_OK", JSON.stringify({ reverted: present }));
} finally {
  await client.end();
}
