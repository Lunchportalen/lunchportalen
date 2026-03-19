#!/usr/bin/env node
/**
 * Apply pending forward-fix migrations to the DB used by .env.local.
 * Two modes:
 * 1) DATABASE_URL set in .env.local → run the three forward-fix SQL files with pg.
 * 2) SUPABASE_DB_PASSWORD or DB_PASSWORD set → run supabase db push.
 * Run from repo root: node scripts/apply-forward-fix-migrations.mjs
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const forwardFixFiles = [
  "20260327000000_content_pages_tree_columns_forward_fix.sql",
  "20260328000000_media_items_forward_fix.sql",
  "20260329000000_forms_forward_fix.sql",
];

const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
const password = (process.env.SUPABASE_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "").trim();

async function applyViaPg() {
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
  const proc = spawn("npx", ["supabase", "db", "push", "--password", password], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  proc.on("close", (code) => process.exit(code ?? 0));
} else {
  console.error(
    "Set in .env.local either DATABASE_URL (direct Postgres URL from Supabase Dashboard → Database) or SUPABASE_DB_PASSWORD, then rerun."
  );
  process.exit(1);
}
