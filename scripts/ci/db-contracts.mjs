import { Client } from "pg";

function mustEnv(name) {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// Koble mot Supabase via DATABASE_URL i CI hvis du vil,
// eller bruk psql/pg med connection string du setter i jobben.
// (Anbefalt: bruk Supabase connection string som secret -> DATABASE_URL_<ENV>)

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("SKIP: DATABASE_URL not set (add if you want deep DB checks).");
  process.exit(0);
}

const requiredTables = [
  "companies",
  "company_locations",
  "profiles",
  "orders",
  "agreements",
];

const requiredFunctions = [
  "lp_order_set",
  "lp_pgrst_reload_schema",
  // legg inn flere RPC’er som er kontrakt
];

const client = new Client({ connectionString: url });
await client.connect();

async function toRegclass(name) {
  const { rows } = await client.query(`select to_regclass($1) as t`, [`public.${name}`]);
  return rows?.[0]?.t;
}

for (const t of requiredTables) {
  const ok = await toRegclass(t);
  if (!ok) {
    console.error(`FAIL: missing table public.${t}`);
    process.exit(1);
  }
}

for (const fn of requiredFunctions) {
  const { rowCount } = await client.query(
    `select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1`,
    [fn]
  );
  if (!rowCount) {
    console.error(`FAIL: missing function public.${fn}()`);
    process.exit(1);
  }
}

console.log("OK: DB contracts verified");
await client.end();
