#!/usr/bin/env node
import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const url = env.STAGING_DATABASE_URL || env.DATABASE_URL_STAGING_CERT;
if (!url) {
  console.error("no staging url");
  process.exit(1);
}
if (url.includes("hkpokyapzarefrgqzkos")) {
  console.error("prod refused");
  process.exit(2);
}

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const mig = await c.query(
  "select version from supabase_migrations.schema_migrations order by version desc limit 1",
);
console.log("STAGING_MIG=" + mig.rows[0].version);
try {
  const q = await c.query(
    "select count(*)::int as n, count(*) filter (where status = 'APPROVED')::int as approved from compliance_review_queue",
  );
  console.log("QUEUE=" + JSON.stringify(q.rows[0]));
} catch (e) {
  console.log("QUEUE_ERR=" + e.message);
}
try {
  const t = await c.query("select count(*)::int as n from tax_source_records");
  console.log("TAX_SOURCES=" + t.rows[0].n);
} catch (e) {
  console.log("TAX_ERR=" + e.message);
}
await c.end();
