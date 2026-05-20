#!/usr/bin/env node
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const { Client } = pg;

const grantsSql = `
SELECT table_name, grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('companies','orders','agreements','profiles','outbox')
  AND grantee IN ('anon','authenticated','service_role','postgres')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;
`;

const rolesSql = `
SELECT r.rolname,
  has_table_privilege(r.rolname, 'public.companies', 'SELECT') AS companies_select,
  has_table_privilege(r.rolname, 'public.companies', 'INSERT') AS companies_insert,
  has_table_privilege(r.rolname, 'public.orders', 'SELECT') AS orders_select,
  has_table_privilege(r.rolname, 'public.orders', 'INSERT') AS orders_insert
FROM pg_roles r
WHERE r.rolname IN ('anon','authenticated','service_role');
`;

const rlsSql = `
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('companies','orders')
ORDER BY tablename, policyname;
`;

const aclSql = `
SELECT c.relname,
       c.relacl::text AS relacl
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('companies','orders');
`;

async function inspect(label, url) {
  if (!url) {
    console.log(`=== ${label}: (no URL) ===\n`);
    return;
  }
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    console.log(`=== ${label} ===`);
    const [grants, roles, rls, acl] = await Promise.all([
      client.query(grantsSql),
      client.query(rolesSql),
      client.query(rlsSql),
      client.query(aclSql),
    ]);

    console.log("\n-- information_schema.role_table_grants --");
    for (const row of grants.rows) {
      console.log(`  ${row.table_name}\t${row.grantee}\t${row.privs}`);
    }

    console.log("\n-- has_table_privilege --");
    for (const row of roles.rows) {
      console.log(
        `  ${row.rolname}\tcompanies SELECT=${row.companies_select} INSERT=${row.companies_insert}\torders SELECT=${row.orders_select} INSERT=${row.orders_insert}`,
      );
    }

    console.log("\n-- pg_class.relacl --");
    for (const row of acl.rows) {
      console.log(`  ${row.relname}\t${row.relacl ?? "(null)"}`);
    }

    console.log(`\n-- RLS policies (${rls.rows.length}) --`);
    for (const row of rls.rows) {
      console.log(`  ${row.tablename}\t${row.policyname}\t${JSON.stringify(row.roles)}\t${row.cmd}`);
    }
    console.log("");
  } finally {
    await client.end();
  }
}

const coreTables = [
  "companies",
  "company_locations",
  "profiles",
  "agreements",
  "orders",
  "outbox",
  "idempotency",
  "ai_activity_log",
];

const gapSql = `
SELECT t.table_name, r.rolname,
  has_table_privilege(r.rolname, 'public.' || t.table_name, 'SELECT') AS sel,
  has_table_privilege(r.rolname, 'public.' || t.table_name, 'INSERT') AS ins
FROM unnest($1::text[]) AS t(table_name)
CROSS JOIN (VALUES ('anon'), ('service_role')) AS r(rolname)
ORDER BY t.table_name, r.rolname;
`;

async function gaps(label, url) {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    console.log(`=== ${label}: missing SELECT/INSERT (anon, service_role) ===`);
    const { rows } = await client.query(gapSql, [coreTables]);
    for (const row of rows) {
      if (!row.sel || !row.ins) {
        console.log(
          `  ${row.table_name}\t${row.rolname}\tSELECT=${row.sel}\tINSERT=${row.ins}`,
        );
      }
    }
    console.log("");
  } finally {
    await client.end();
  }
}

await inspect("STAGING", process.env.SUPABASE_POSTGRES_URL);
await inspect("PROD", process.env.DATABASE_URL);
await gaps("STAGING", process.env.SUPABASE_POSTGRES_URL);
await gaps("PROD", process.env.DATABASE_URL);
