#!/usr/bin/env node
/**
 * Run Supabase health-check audit pack queries A, B, C, D, G against the current DB.
 * Outputs JSON with real results only. Requires: DATABASE_URL or local Supabase on 54322.
 * Usage: node scripts/db/run-health-audit.mjs
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

let Client;
try {
  const pg = await import("pg");
  Client = pg.default?.Client ?? pg.Client;
} catch {
  Client = null;
}

const projectRoot = join(process.cwd());
const auditPackPath = join(projectRoot, "docs", "db", "SUPABASE_HEALTH_CHECK_AUDIT_PACK.md");

const QUERIES = {
  A: {
    title: "Public tables without primary keys",
    sql: `
SELECT t.schemaname, t.tablename
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE t.schemaname = 'public' AND c.relkind = 'r'
  AND NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conrelid = c.oid AND pc.contype = 'p')
ORDER BY t.tablename;
`,
  },
  B: {
    title: "Public tables without RLS enabled",
    sql: `
SELECT n.nspname AS schema_name, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY c.relname;
`,
  },
  C: {
    title: "Public tables with RLS enabled but zero policies",
    sql: `
SELECT n.nspname AS schema_name, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname)
ORDER BY c.relname;
`,
  },
  D: {
    title: "Foreign keys possibly lacking supporting index",
    sql: `
WITH fk_key_cols AS (
  SELECT c.conrelid AS table_oid, c.conname AS fk_name,
         (SELECT array_agg(attnum ORDER BY ord) FROM unnest(c.conkey::int[]) WITH ORDINALITY AS u(attnum, ord)) AS key_cols
  FROM pg_constraint c
  WHERE c.contype = 'f' AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
),
index_key_cols AS (
  SELECT i.indrelid,
         (SELECT array_agg(k ORDER BY ord) FROM unnest(i.indkey::int[]) WITH ORDINALITY AS u(k, ord)) AS idx_cols
  FROM pg_index i
  WHERE i.indisvalid
)
SELECT n.nspname AS schema_name, t.relname AS table_name, fk.fk_name, fk.key_cols AS fk_column_attnums
FROM fk_key_cols fk
JOIN pg_class t ON t.oid = fk.table_oid
JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
WHERE NOT EXISTS (
  SELECT 1 FROM index_key_cols ic
  WHERE ic.indrelid = fk.table_oid
    AND (ic.idx_cols = fk.key_cols
         OR (array_length(ic.idx_cols, 1) >= array_length(fk.key_cols, 1)
             AND ic.idx_cols[1:array_length(fk.key_cols, 1)] = fk.key_cols))
)
ORDER BY n.nspname, t.relname, fk.fk_name;
`,
  },
  G: {
    title: "Policy overview for key backoffice tables",
    sql: `
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual IS NOT NULL AS has_using, with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('content_pages','content_page_variants','media_items','forms','form_submissions','agreements','company_locations','companies','profiles','marketing_pages')
ORDER BY tablename, policyname;
`,
  },
};

function getConnectionUrl() {
  return process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
}

async function run() {
  const out = { ranAt: new Date().toISOString(), connection: getConnectionUrl().replace(/:[^:@]+@/, ":****@"), results: {} };

  if (!Client) {
    out.error = "pg not installed (npm i -D pg)";
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const client = new Client({ connectionString: getConnectionUrl() });
  try {
    await client.connect();
  } catch (e) {
    out.error = `Could not connect: ${e.message}`;
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  try {
    for (const [key, { title, sql }] of Object.entries(QUERIES)) {
      try {
        const { rows } = await client.query(sql.trim());
        out.results[key] = { title, rowCount: rows.length, rows };
      } catch (err) {
        out.results[key] = { title, error: err.message, rowCount: 0, rows: [] };
      }
    }
  } finally {
    await client.end();
  }

  console.log(JSON.stringify(out, null, 2));
}

run();
