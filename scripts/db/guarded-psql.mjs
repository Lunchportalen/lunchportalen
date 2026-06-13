#!/usr/bin/env node
/**
 * Manual SQL / ledger ops — guarded psql wrapper.
 *
 *   node scripts/db/guarded-psql.mjs --expect staging -- -f scripts/db/seed-environment-sentinel-staging.sql
 *   node scripts/db/guarded-psql.mjs --expect staging -- -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3"
 *
 * Everything after `--` is passed to psql unchanged.
 */
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { assertDbTarget } from "../ci/assert-db-target.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/** @typedef {"staging" | "production"} DbEnvironment */

function parseArgs(argv) {
  /** @type {{ expect?: DbEnvironment, psqlArgs: string[] }} */
  const out = { psqlArgs: [] };
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === "--expect" && argv[i + 1]) {
      out.expect = /** @type {DbEnvironment} */ (argv[++i]);
      i++;
      continue;
    }
    if (argv[i] === "--") {
      out.psqlArgs = argv.slice(i + 1);
      break;
    }
    i++;
  }
  return out;
}

const { expect, psqlArgs } = parseArgs(process.argv.slice(2));

if (expect !== "staging" && expect !== "production") {
  console.error("::error::guarded-psql: --expect staging|production is required");
  process.exit(1);
}

if (psqlArgs.length === 0) {
  console.error("::error::guarded-psql: pass psql args after --");
  process.exit(1);
}

const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) {
  console.error("::error::guarded-psql: DATABASE_URL not set");
  process.exit(1);
}

const guard = await assertDbTarget({ connectionString: databaseUrl, expect });
if (guard.decision !== "proceed") {
  console.error(`::error::guarded-psql ABORT before psql (${guard.reason})`);
  process.exit(1);
}

console.log(`guarded-psql: target verified (${expect}) — running psql`);

const proc = spawn("psql", [databaseUrl, ...psqlArgs], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false,
});

proc.on("close", (code) => process.exit(code ?? 0));
