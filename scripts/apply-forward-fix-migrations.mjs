#!/usr/bin/env node
/**
 * Apply pending forward-fix migrations to the DB used by .env.local.
 * Two modes:
 * 1) DATABASE_URL set in .env.local → run the three forward-fix SQL files with pg.
 * 2) SUPABASE_DB_PASSWORD or DB_PASSWORD set → run supabase db push.
 * Run from repo root: node scripts/apply-forward-fix-migrations.mjs
 *
 * Requires --expect staging|production (fail-closed target guard).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import { assertDbTarget } from "./ci/assert-db-target.mjs";

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
  console.error("::error::apply-forward-fix: --expect staging|production is required");
  process.exit(1);
}

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const forwardFixFiles = [
  "20260327000000_content_pages_tree_columns_forward_fix.sql",
  "20260328000000_media_items_forward_fix.sql",
  "20260329000000_forms_forward_fix.sql",
];

const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
const password = (process.env.SUPABASE_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "").trim();

async function assertTarget(url) {
  const guard = await assertDbTarget({ connectionString: url, expect });
  if (guard.decision !== "proceed") {
    console.error(`::error::apply-forward-fix ABORT (${guard.reason})`);
    process.exit(1);
  }
}

async function applyViaPg() {
  await assertTarget(databaseUrl);
  const { Client } = await import("pg");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const name of forwardFixFiles) {
      const path = join(migrationsDir, name);
      const sql = readFileSync(path, "utf8");
      await client.query(sql);
      console.log(`Applied: ${name}`);
    }
  } finally {
    await client.end();
  }
}

if (databaseUrl) {
  applyViaPg()
    .then(() => {
      console.log("Forward-fix migrations applied via DATABASE_URL.");
    })
    .catch((err) => {
      console.error("Apply failed:", err.message);
      process.exit(1);
    });
} else if (password) {
  console.error(
    "::error::apply-forward-fix: set DATABASE_URL (with --expect) for guarded apply; password-only db push is disabled.",
  );
  process.exit(1);
} else {
  console.error(
    "Set DATABASE_URL in .env.local, pass --expect staging|production, then rerun.",
  );
  process.exit(1);
}
