#!/usr/bin/env node
/**
 * Phase 15G.2 — staging fail-closed matrix (staging DB only).
 * Proves kill-switch, jurisdiction counts, zero APPROVED tax rules, no forged cutover.
 * Does NOT create legal invoices. Does NOT touch production.
 */
import { loadEnvFiles, STAGING_REF, PROD_REF } from "../smoke/resolve-staging-database-url.mjs";
import pg from "pg";

const COUNTRIES = [
  "NO","SE","DK","FI","GB","DE","FR","ES","IT","NL",
  "BE","CH","AT","IE","PL","RO","CZ","PT","GR","US","CA",
];

loadEnvFiles(process.cwd());
const pw = encodeURIComponent(String(process.env.SUPABASE_DB_PASSWORD_STAGING ?? "").trim());
if (!pw) {
  console.error("NO_STAGING_PASSWORD");
  process.exit(2);
}
const url = `postgresql://postgres:${pw}@db.${STAGING_REF}.supabase.co:5432/postgres`;
if (url.includes(PROD_REF)) {
  console.error("ABORT_PROD");
  process.exit(3);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const results = [];
const pass = (id, ok, detail) => {
  results.push({ id, pass: ok, detail });
  console.log(`${ok ? "OK" : "FAIL"}: ${id} — ${detail}`);
};

const head = await client.query(
  "select version from supabase_migrations.schema_migrations order by version desc limit 1",
);
pass(
  "migration_head",
  head.rows[0]?.version === "20260831120000" || head.rows[0]?.version === "20260830120000",
  String(head.rows[0]?.version),
);

const kill = await client.query(
  "select global_cutover_allowed, technical_21_complete from global_activation_kill_switch where id=1",
);
pass(
  "kill_switch",
  kill.rows[0]?.global_cutover_allowed === false && kill.rows[0]?.technical_21_complete === false,
  JSON.stringify(kill.rows[0]),
);

const approved = await client.query(
  "select count(*)::int as n from tax_rules where review_status='APPROVED'",
);
pass("no_forged_tax_approvals", approved.rows[0].n === 0, `approved=${approved.rows[0].n}`);

const us = await client.query(
  "select count(*)::int as n from jurisdictions where country_code='US' and level='state'",
);
pass("us_51", us.rows[0].n === 51, `us=${us.rows[0].n}`);

const ca = await client.query(
  "select count(*)::int as n from jurisdictions where country_code='CA' and level='province'",
);
pass("ca_13", ca.rows[0].n === 13, `ca=${ca.rows[0].n}`);

const markets = await client.query(
  "select count(*)::int as n from marketplace_legal_models where status='APPROVED'",
);
pass("marketplace_approvals_zero", markets.rows[0].n === 0, `approved=${markets.rows[0].n}`);

const einv = await client.query(
  "select count(*)::int as n from e_invoice_capabilities where reviewer_approval='APPROVED'",
);
pass("e_invoice_approvals_zero", einv.rows[0].n === 0, `approved=${einv.rows[0].n}`);

for (const c of COUNTRIES) {
  const row = await client.query(
    "select status from marketplace_legal_models where country_code=$1",
    [c],
  );
  pass(`marketplace_${c}`, row.rows[0]?.status === "DRAFT", row.rows[0]?.status ?? "MISSING");
}

await client.end();

const failed = results.filter((r) => !r.pass);
console.log(JSON.stringify({ staging_ref: STAGING_REF, failed: failed.length, total: results.length }, null, 2));
process.exit(failed.length ? 1 : 0);
