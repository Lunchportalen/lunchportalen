#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const { Client } = pg;
const root = process.cwd();

const preSql = `
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('companies', 'outbox')
  AND grantee IN ('anon', 'service_role', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
`;

const postSql = `
SELECT table_name, grantee, count(*)::int AS priv_count
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'companies', 'company_locations', 'profiles', 'agreements', 'orders',
    'idempotency', 'ai_activity_log', 'outbox'
  )
  AND grantee IN ('anon', 'service_role', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;
`;

const prodRpcPre = `
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name LIKE 'lp_%saas%';
`;

const prodRpcPost = `
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'lp_provider_generate_invoice_for_period',
    'lp_generate_saas_invoices_for_period'
  );
`;

const outboxPatternSql = `
SELECT count(*)::text AS n FROM public.outbox
WHERE event_key LIKE 'tripletex.saas_invoice_create_lp:%';
`;

async function query(url, label, sql) {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log(`\n=== ${label} ===`);
    const { rows } = await client.query(sql);
    for (const row of rows) console.log(JSON.stringify(row));
    return rows;
  } finally {
    await client.end();
  }
}

async function apply(url, label, migrationFile) {
  const sql = readFileSync(join(root, "supabase/migrations", migrationFile), "utf8");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log(`\n>>> Applying ${migrationFile} to ${label}`);
    await client.query(sql);
    console.log(`>>> OK: ${label}`);
  } finally {
    await client.end();
  }
}

const stagingUrl = process.env.SUPABASE_POSTGRES_URL;
const prodUrl = process.env.DATABASE_URL;
const mode = process.argv[2] || "staging-grants";

if (mode === "staging-grants") {
  await query(stagingUrl, "STAGING PRE", preSql);
  await apply(stagingUrl, "STAGING", "20260524120000_staging_repair_core_table_grants.sql");
  const rows = await query(stagingUrl, "STAGING POST", postSql);
  const expected = 22;
  if (rows.length !== expected) {
    console.error(`\nFAIL: expected ${expected} grant groups, got ${rows.length}`);
    process.exit(1);
  }
  const outboxAnon = rows.find((r) => r.table_name === "outbox" && r.grantee === "anon");
  if (outboxAnon) {
    console.error("\nFAIL: outbox should not have anon grants");
    process.exit(1);
  }
  console.log(`\nPASS: ${rows.length} grant groups (expected ${expected})`);
} else if (mode === "prod-tpt-a4") {
  await query(prodUrl, "PROD RPC PRE", prodRpcPre);
  await apply(prodUrl, "PROD", "20260523120000_tpt_a4_saas_invoice_generation.sql");
  await query(prodUrl, "PROD RPC POST", prodRpcPost);
  await query(prodUrl, "PROD OUTBOX PATTERN", outboxPatternSql);
} else {
  console.error("Usage: node apply-grant-migration.mjs [staging-grants|prod-tpt-a4]");
  process.exit(1);
}
