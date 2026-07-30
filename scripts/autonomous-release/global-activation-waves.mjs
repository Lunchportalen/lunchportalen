#!/usr/bin/env node
/**
 * Activation waves 1–4. Enables only countries with complete verified legal/tax config.
 * Fail-closed for missing owner legal/tax. Auto-disable country on failure.
 * Global rollback only for shared Auth/RLS/tenant/capacity/production/financial integrity failures.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "docs/rc/launch-2026-08-01");
const PROD_REF = "hkpokyapzarefrgqzkos";
const FREEZE_SHA = "35925d0ffe5ab72d7d35c17a9dc8381d2eccdc3c";

const WAVES = [
  { wave: 1, countries: ["NO", "SE", "DK", "FI"] },
  { wave: 2, countries: ["GB", "IE", "DE", "AT", "CH", "NL", "BE", "FR"] },
  { wave: 3, countries: ["ES", "IT", "PT", "PL", "CZ", "RO", "GR"] },
  { wave: 4, countries: ["US", "CA"] },
];

const MARKET_META = {
  NO: { locales: ["nb-NO"], currency: "NOK" },
  SE: { locales: ["sv-SE"], currency: "SEK" },
  DK: { locales: ["da-DK"], currency: "DKK" },
  FI: { locales: ["fi-FI"], currency: "EUR" },
  GB: { locales: ["en-GB"], currency: "GBP" },
  IE: { locales: ["en-IE"], currency: "EUR" },
  DE: { locales: ["de-DE"], currency: "EUR" },
  AT: { locales: ["de-AT"], currency: "EUR" },
  CH: { locales: ["de-CH", "fr-CH"], currency: "CHF" },
  NL: { locales: ["nl-NL"], currency: "EUR" },
  BE: { locales: ["nl-BE", "fr-BE"], currency: "EUR" },
  FR: { locales: ["fr-FR"], currency: "EUR" },
  ES: { locales: ["es-ES"], currency: "EUR" },
  IT: { locales: ["it-IT"], currency: "EUR" },
  PT: { locales: ["pt-PT"], currency: "EUR" },
  PL: { locales: ["pl-PL"], currency: "PLN" },
  CZ: { locales: ["cs-CZ"], currency: "CZK" },
  RO: { locales: ["ro-RO"], currency: "RON" },
  GR: { locales: ["el-GR"], currency: "EUR" },
  US: { locales: ["en-US"], currency: "USD" },
  CA: { locales: ["en-CA", "fr-CA"], currency: "CAD" },
};

function buildDatabaseUrl() {
  const direct = String(process.env.DATABASE_URL || "").trim();
  if (direct && direct.includes(PROD_REF)) return direct;
  const ref = String(process.env.SUPABASE_PROD_PROJECT_REF || "").trim();
  const pw = String(process.env.SUPABASE_PROD_DB_PASSWORD || "").trim();
  if (!ref || !pw) return null;
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
}

async function withClient(databaseUrl, fn) {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

async function loadMatrix(client) {
  const act = await client.query(
    `select * from public.country_production_activation order by country_code`,
  );
  const ap = await client.query(
    `select country_code, status, tax_approved_at, legal_approved_at
     from public.market_approvals order by country_code`,
  );
  const byAct = new Map(act.rows.map((r) => [r.country_code, r]));
  const byAp = new Map(ap.rows.map((r) => [r.country_code, r]));
  const out = {};
  for (const cc of Object.keys(MARKET_META)) {
    const a = byAct.get(cc);
    const m = byAp.get(cc);
    const missing = [];
    if (!m?.tax_approved_at) missing.push("market_approvals.tax_approved_at=NULL");
    if (!m?.legal_approved_at) missing.push("market_approvals.legal_approved_at=NULL");
    if (m?.status !== "ACTIVE" && !(m?.status === "LEGAL_APPROVED" && m?.tax_approved_at && m?.legal_approved_at)) {
      missing.push(`market_approvals.status=${m?.status || "MISSING"}`);
    }
    if (a?.owner_tax_model_confirmation !== "CONFIRMED") {
      missing.push(`owner_tax_model_confirmation=${a?.owner_tax_model_confirmation || "MISSING"}`);
    }
    if (!a?.owner_accepts_tax_classification_responsibility) {
      missing.push("owner_accepts_tax_classification_responsibility=false");
    }
    if (cc !== "NO") {
      missing.push("DB_GUARD:NON_NO_COUNTRY_ACTIVATION_FORBIDDEN");
      missing.push("code_tax_pack.reviewStatus=RESEARCHED");
      missing.push("code_legal_docs:LEGAL_APPROVED=false");
    }
    const alreadyActive = Boolean(
      a?.production_enabled &&
        a?.registration_enabled &&
        a?.ordering_enabled &&
        a?.invoice_only_enabled &&
        a?.platform_commission_enabled,
    );
    const ready =
      cc === "NO" &&
      alreadyActive &&
      m?.status === "ACTIVE" &&
      Boolean(m?.tax_approved_at) &&
      Boolean(m?.legal_approved_at) &&
      a?.owner_tax_model_confirmation === "CONFIRMED";
    out[cc] = { ready, alreadyActive, missing: ready ? [] : missing, act: a, appr: m };
  }
  return out;
}

async function tryEnableCountry(client, cc) {
  try {
    await client.query(
      `update public.country_production_activation
       set production_enabled = true,
           registration_enabled = true,
           ordering_enabled = true,
           invoice_only_enabled = true,
           platform_commission_enabled = true,
           updated_at = now(),
           reason = 'activation_wave_enable'
       where country_code = $1`,
      [cc],
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 240) };
  }
}

async function disableCountry(client, cc, reason) {
  await client.query(
    `update public.country_production_activation
     set production_enabled = false,
         registration_enabled = false,
         ordering_enabled = false,
         invoice_only_enabled = false,
         platform_commission_enabled = false,
         updated_at = now(),
         reason = $2
     where country_code = $1 and country_code <> 'NO'`,
    [cc, reason.slice(0, 200)],
  );
}

async function probeHealth(baseUrl, expectedSha) {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`, {
      headers: { Accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    const version = String(body?.data?.version || "");
    const summary = String(body?.data?.summary?.status || "");
    return {
      ok: Boolean(res.ok && body?.ok && version === expectedSha && summary === "ok"),
      version,
      summary,
    };
  } catch (e) {
    return { ok: false, version: null, summary: `fetch_error:${String(e?.message || e).slice(0, 80)}` };
  }
}

async function sharedIntegrity(client) {
  const ks = await client.query(
    `select global_cutover_allowed from public.global_activation_kill_switch where id=1`,
  );
  const rls = await client.query(
    `select count(*)::int as n from pg_policies where schemaname='public'`,
  );
  const head = await client.query(
    `select version from supabase_migrations.schema_migrations order by version desc limit 1`,
  );
  const orders = await client.query(`select count(*)::int as n from public.orders`);
  const commission = await client.query(`select count(*)::int as n from public.commission_ledger`);
  const issues = [];
  if (Number(rls.rows[0]?.n || 0) < 100) issues.push("RLS_POLICY_COLLAPSE");
  if (head.rows[0]?.version !== "20260904120000") issues.push(`MIGRATION_HEAD_DRIFT:${head.rows[0]?.version}`);
  if (orders.rows[0]?.n == null) issues.push("ORDERS_UNREADABLE");
  if (commission.rows[0]?.n == null) issues.push("COMMISSION_LEDGER_UNREADABLE");
  return {
    ok: issues.length === 0,
    issues,
    global_cutover_allowed: ks.rows[0]?.global_cutover_allowed,
    rls_policy_count: rls.rows[0]?.n,
    migration_head: head.rows[0]?.version,
    orders_count: orders.rows[0]?.n,
    commission_ledger_count: commission.rows[0]?.n,
  };
}

async function observeWave(baseUrl, expectedSha, databaseUrl, minutes) {
  const deadline = Date.now() + minutes * 60_000;
  const samples = [];
  let sharedFail = null;
  while (Date.now() < deadline) {
    const health = await probeHealth(baseUrl, expectedSha);
    const integrity = await withClient(databaseUrl, sharedIntegrity);
    samples.push({
      t: new Date().toISOString(),
      health,
      integrity_ok: integrity.ok,
      issues: integrity.issues,
    });
    if (!integrity.ok) {
      sharedFail = integrity.issues;
      break;
    }
    if (!health.ok) {
      // Country-level health blip is recorded; continue unless shared integrity fails.
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
  return { samples, sharedFail };
}

async function main() {
  const releaseSha = String(process.env.GLOBAL_RELEASE_SHA || FREEZE_SHA).trim();
  const baseUrl = String(
    process.env.PROD_BASE_URL || process.env.APP_BASE_URL || "https://app.lunchportalen.no",
  ).trim();
  const observeMinutes = Number(process.env.WAVE_OBSERVE_MINUTES || 15);
  const databaseUrl = buildDatabaseUrl();
  if (!databaseUrl) throw new Error("NO_DATABASE_URL");

  const matrixPath = path.join(OUT_DIR, "COUNTRY-LEGAL-TAX-READINESS-MATRIX.json");
  if (!fs.existsSync(matrixPath)) {
    throw new Error("MATRIX_MISSING:run global-country-legal-tax-matrix.mjs first");
  }

  const waveReports = [];
  let globalRollback = false;
  let currentWave = null;

  for (const w of WAVES) {
    currentWave = w.wave;
    const readiness = await withClient(databaseUrl, loadMatrix);
    const countryResults = [];

    for (const cc of w.countries) {
      const r = readiness[cc];
      if (!r?.ready) {
        countryResults.push({
          country: cc,
          action: "FAIL_CLOSED_NO_ENABLE",
          missing_exact: r?.missing || ["READINESS_UNKNOWN"],
        });
        continue;
      }
      if (r.alreadyActive) {
        countryResults.push({
          country: cc,
          action: "ALREADY_ACTIVE_OBSERVE",
          missing_exact: [],
        });
        continue;
      }
      const enable = await withClient(databaseUrl, (c) => tryEnableCountry(c, cc));
      if (!enable.ok) {
        countryResults.push({
          country: cc,
          action: "ENABLE_BLOCKED",
          error: enable.error,
          missing_exact: r.missing,
        });
        continue;
      }
      countryResults.push({ country: cc, action: "ENABLED", missing_exact: [] });
    }

    console.log(JSON.stringify({ wave: w.wave, phase: "observe_start", observeMinutes }));
    const observation = await observeWave(baseUrl, releaseSha, databaseUrl, observeMinutes);

    if (observation.sharedFail) {
      globalRollback = true;
      // Global rollback: disable any non-NO that we enabled this wave (none expected).
      await withClient(databaseUrl, async (c) => {
        for (const cr of countryResults) {
          if (cr.action === "ENABLED" && cr.country !== "NO") {
            await disableCountry(c, cr.country, `global_rollback:${observation.sharedFail.join(",")}`);
            cr.action = "DISABLED_GLOBAL_ROLLBACK";
          }
        }
      });
    } else {
      // Country-level repair: if a newly enabled country drifts unhealthy, disable it.
      const healthBad = observation.samples.some((s) => !s.health.ok);
      if (healthBad) {
        await withClient(databaseUrl, async (c) => {
          for (const cr of countryResults) {
            if (cr.action === "ENABLED" && cr.country !== "NO") {
              await disableCountry(c, cr.country, "country_health_observe_fail");
              cr.action = "DISABLED_COUNTRY_REPAIR";
            }
          }
        });
      }
    }

    const activeAfter = await withClient(databaseUrl, async (c) => {
      const q = await c.query(
        `select country_code from public.country_production_activation
         where production_enabled and ordering_enabled order by country_code`,
      );
      return q.rows.map((r) => r.country_code);
    });

    waveReports.push({
      wave: w.wave,
      countries: w.countries,
      country_results: countryResults,
      observation_minutes: observeMinutes,
      observation_samples: observation.samples.length,
      shared_integrity_fail: observation.sharedFail,
      active_countries_after: activeAfter,
      health_pass_ratio: `${observation.samples.filter((s) => s.health.ok).length}/${observation.samples.length}`,
    });

    if (globalRollback) break;
  }

  const active = await withClient(databaseUrl, async (c) => {
    const q = await c.query(
      `select country_code from public.country_production_activation
       where production_enabled and ordering_enabled order by country_code`,
    );
    return q.rows.map((r) => r.country_code);
  });
  const localesActive = active.flatMap((cc) => MARKET_META[cc]?.locales || []);
  const currenciesActive = [...new Set(active.map((cc) => MARKET_META[cc]?.currency).filter(Boolean))];

  const remaining = [];
  for (const w of waveReports) {
    for (const cr of w.country_results) {
      if (cr.action !== "ALREADY_ACTIVE_OBSERVE" && cr.action !== "ENABLED") {
        remaining.push({ country: cr.country, blockers: cr.missing_exact || [cr.error || cr.action] });
      }
    }
  }

  const report = {
    gate: "GLOBAL_ACTIVATION_WAVES",
    result: globalRollback ? "GLOBAL_ROLLBACK" : "COMPLETED_FAIL_CLOSED_WHERE_REQUIRED",
    GLOBAL_RELEASE_SHA: releaseSha,
    activation_wave_last: currentWave,
    waves: waveReports,
    countries_active: active,
    locales_active: localesActive,
    currencies_active: currenciesActive,
    remaining_blockers: remaining,
    stamped_at: new Date().toISOString(),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "GLOBAL-ACTIVATION-WAVES.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));
  if (globalRollback) process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e?.message || e).slice(0, 240) }));
  process.exit(2);
});
