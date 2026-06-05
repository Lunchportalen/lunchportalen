#!/usr/bin/env node
/**
 * Manual migration apply — guarded db push (never raw supabase db push).
 *
 *   node scripts/db/guarded-db-push.mjs --expect staging
 *   node scripts/db/guarded-db-push.mjs --expect production
 *
 * Requires DATABASE_URL pointing at the intended target.
 */
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { assertDbTarget } from "../ci/assert-db-target.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/** @typedef {"staging" | "production"} DbEnvironment */

function parseExpect(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--expect" && argv[i + 1]) {
      return /** @type {DbEnvironment} */ (argv[++i]);
    }
  }
  return null;
}

const expect = parseExpect(process.argv.slice(2));
if (expect !== "staging" && expect !== "production") {
  console.error("::error::guarded-db-push: --expect staging|production is required");
  process.exit(1);
}

const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) {
  console.error("::error::guarded-db-push: DATABASE_URL not set");
  process.exit(1);
}

const guard = await assertDbTarget({ connectionString: databaseUrl, expect });
if (guard.decision !== "proceed") {
  console.error(`::error::guarded-db-push ABORT before db push (${guard.reason})`);
  process.exit(1);
}

console.log(`guarded-db-push: target verified (${expect}) — running supabase db push`);

const proc = spawn("supabase", ["db", "push", "--db-url", databaseUrl, "--yes"], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: true,
});

proc.on("close", (code) => process.exit(code ?? 0));
