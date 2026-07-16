#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");
const STAGING_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";
const MIG = "20260901120000_global_15g3b_review_operations.sql";

function loadEnvLocal() {
  const p = join(root, ".env.local");
  if (!existsSync(p)) return {};
  return Object.fromEntries(
    readFileSync(p, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );
}

async function main() {
  if (process.env.CONFIRM_STAGING_MIGRATION !== "YES") {
    console.log("Set CONFIRM_STAGING_MIGRATION=YES to apply on staging");
    process.exit(0);
  }
  const env = loadEnvLocal();
  const url = process.env.DATABASE_URL || env.STAGING_DATABASE_URL || env.DATABASE_URL_STAGING_CERT || "";
  if (!url || url.includes(PROD_REF) || !url.includes(STAGING_REF)) {
    console.error("REFUSE: staging URL required");
    process.exit(3);
  }
  const sql = readFileSync(join(root, "supabase/migrations", MIG), "utf8");
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const before = await c.query(
    `select version from supabase_migrations.schema_migrations order by version desc limit 1`,
  );
  console.log("BEFORE=" + before.rows[0]?.version);
  if (before.rows[0]?.version >= "20260901120000") {
    console.log("Migration already applied");
    await c.end();
    process.exit(0);
  }
  await c.query(sql);
  await c.query(`insert into supabase_migrations.schema_migrations (version) values ($1) on conflict do nothing`, [
    "20260901120000",
  ]);
  const after = await c.query(
    `select version from supabase_migrations.schema_migrations order by version desc limit 1`,
  );
  console.log("AFTER=" + after.rows[0]?.version);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
