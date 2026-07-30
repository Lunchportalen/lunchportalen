#!/usr/bin/env node
/**
 * Internal global canary 21/21 against production runtime.
 * Does NOT enable customer markets. Uses read-only + dry-run probes.
 * Fail-closed when a country runtime surface is unreachable or misconfigured.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "docs/rc/launch-2026-08-01");
const PROD_REF = "hkpokyapzarefrgqzkos";
const COUNTRIES = [
  "NO","SE","DK","FI","GB","DE","FR","ES","IT","NL","BE","CH","AT","IE","PL","RO","CZ","PT","GR","US","CA",
];

function buildDatabaseUrl() {
  const direct = String(process.env.DATABASE_URL || "").trim();
  if (direct && direct.includes(PROD_REF)) return direct;
  const ref = String(process.env.SUPABASE_PROD_PROJECT_REF || "").trim();
  const pw = String(process.env.SUPABASE_PROD_DB_PASSWORD || "").trim();
  if (!ref || !pw) return null;
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
}

async function main() {
  const releaseSha = String(process.env.GLOBAL_RELEASE_SHA || "").trim();
  const baseUrl = String(process.env.PROD_BASE_URL || process.env.APP_BASE_URL || "https://app.lunchportalen.no").trim();
  const healthRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`);
  const health = await healthRes.json().catch(() => ({}));
  const version = String(health?.data?.version || "");
  if (!healthRes.ok || !health?.ok) throw new Error("HEALTH_FAIL");
  if (releaseSha && version !== releaseSha) {
    throw new Error(`SHA_MISMATCH:health=${version}:expected=${releaseSha}`);
  }

  const databaseUrl = buildDatabaseUrl();
  if (!databaseUrl) throw new Error("NO_DATABASE_URL");
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();

  const results = [];
  try {
    const markets = await client.query(
      `select country_code, is_active from public.markets where country_code = any($1::text[])`,
      [COUNTRIES],
    );
    const byCode = new Map(markets.rows.map((r) => [r.country_code, r]));

    const activation = await client.query(
      `select country_code, production_enabled, ordering_enabled
       from public.country_production_activation where country_code = any($1::text[])`,
      [COUNTRIES],
    );
    const act = new Map(activation.rows.map((r) => [r.country_code, r]));

    const ks = await client.query(
      `select global_cutover_allowed from public.global_activation_kill_switch where id=1`,
    );
    const globalOff = ks.rows[0]?.global_cutover_allowed === false;

    for (const cc of COUNTRIES) {
      const m = byCode.get(cc);
      const a = act.get(cc);
      const marketOk = Boolean(m); // row present (active or scaffold)
      const gateOk = Boolean(a);
      const newMarketDisabled =
        cc === "NO" ? true : !(a?.production_enabled || a?.ordering_enabled);
      const pass = marketOk && gateOk && newMarketDisabled && globalOff;
      results.push({
        country: cc,
        status: pass ? "PASS" : "FAIL",
        market_present: marketOk,
        market_active: Boolean(m?.is_active),
        activation_row: gateOk,
        production_enabled: Boolean(a?.production_enabled),
        ordering_enabled: Boolean(a?.ordering_enabled),
        global_cutover_allowed: ks.rows[0]?.global_cutover_allowed ?? null,
      });
    }
  } finally {
    await client.end().catch(() => {});
  }

  const passCount = results.filter((r) => r.status === "PASS").length;
  const report = {
    gate: "INTERNAL_GLOBAL_CANARY",
    result: passCount === 21 ? "PASS" : "FAIL",
    score: `${passCount}/21`,
    GLOBAL_RELEASE_SHA: releaseSha || null,
    production_sha: version,
    countries: results,
    stamped_at: new Date().toISOString(),
    note: "Internal canary: 21/21 country rows + kill-switch posture; customer activation remains separate",
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "INTERNAL-GLOBAL-CANARY.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.result !== "PASS") process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e?.message || e).slice(0, 240) }));
  process.exit(2);
});
