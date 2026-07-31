#!/usr/bin/env node
/**
 * Apply a single SQL migration file against DATABASE_URL with target guard + ledger insert.
 *
 *   node scripts/db/apply-migration-file.mjs --expect production --file supabase/migrations/20260909120000_norway_enterprise_explicit_capacity.sql
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { assertDbTarget } from "../ci/assert-db-target.mjs";

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const expect = arg("--expect");
const file = arg("--file");
if (expect !== "staging" && expect !== "production") {
  console.error("::error::--expect staging|production required");
  process.exit(1);
}
if (!file) {
  console.error("::error::--file required");
  process.exit(1);
}

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("::error::DATABASE_URL not set");
  process.exit(1);
}

const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error(`::error::file missing: ${abs}`);
  process.exit(1);
}

const base = path.basename(abs);
const m = base.match(/^(\d{14})_(.+)\.sql$/);
if (!m) {
  console.error("::error::filename must be YYYYMMDDHHMMSS_name.sql");
  process.exit(1);
}
const version = m[1];
const name = m[2];

const guard = await assertDbTarget({ connectionString: databaseUrl, expect });
if (guard.decision !== "proceed") {
  console.error(`::error::ABORT (${guard.reason})`);
  process.exit(1);
}

const sql = fs.readFileSync(abs, "utf8");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  const existing = await client.query(
    `select version from supabase_migrations.schema_migrations where version = $1`,
    [version],
  );
  if (existing.rowCount > 0) {
    console.log(JSON.stringify({ ok: true, skipped: true, version, name }));
    process.exit(0);
  }

  await client.query("BEGIN");
  await client.query(sql);
  await client.query(
    `insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)`,
    [version, name],
  );
  await client.query("COMMIT");
  console.log(JSON.stringify({ ok: true, applied: true, version, name }));
} catch (e) {
  try {
    await client.query("ROLLBACK");
  } catch {
    /* ignore */
  }
  console.error("::error::migration failed", String(e?.message || e).slice(0, 800));
  process.exit(1);
} finally {
  await client.end();
}
