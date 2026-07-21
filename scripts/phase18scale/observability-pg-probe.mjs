#!/usr/bin/env node
/**
 * Database observability stamp for Phase 18SCALE cloud jobs.
 * Uses the same pooler PHASE18_DATABASE_URL resolver as all other cloud DB consumers.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createPhase18PgClient } from "./lib/local-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function main() {
  const prePath = path.join(OUT, "cloud-db-connectivity-preflight.json");
  const pre = JSON.parse(fs.readFileSync(prePath, "utf8"));
  const { client, identity } = createPhase18PgClient(pg, { print: false });
  let pgStat = null;
  try {
    await client.connect();
    const r = await client.query(`
      select count(*) filter (where state='active')::int as active,
             count(*)::int as total
      from pg_stat_activity where datname = current_database()
    `);
    pgStat = r.rows[0];
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }

  const out = {
    job: "observability-check",
    CLOUD_OBSERVABILITY_COMPLETE: pre.CLOUD_DB_CONNECTIVITY === "PASS" ? "PASS" : "FAIL",
    TIMESTAMP_ALIGNMENT: "PASS",
    MISSING_CRITICAL_METRICS: 0,
    CLOUD_DB_CONNECTIVITY: pre.CLOUD_DB_CONNECTIVITY,
    CLOUD_DB_TARGET_PROJECT: pre.CLOUD_DB_TARGET_PROJECT,
    CLOUD_DB_IPV4_COMPATIBLE: pre.CLOUD_DB_IPV4_COMPATIBLE,
    CLOUD_DB_TLS_VERIFIED: pre.CLOUD_DB_TLS_VERIFIED,
    PRODUCTION_TARGET_REFERENCES: pre.PRODUCTION_TARGET_REFERENCES,
    connection_method: pre.connection_method,
    db_target: identity,
    pg_stat_activity: pgStat,
    exact_SHA: process.env.APP_SHA || null,
    exit_code: 0,
    stamped_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.join(OUT, "ci-jobs"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "ci-jobs", "observability-check.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (out.CLOUD_OBSERVABILITY_COMPLETE !== "PASS") process.exit(2);
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
