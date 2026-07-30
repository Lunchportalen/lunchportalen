#!/usr/bin/env node
/**
 * Post-promote production verification (no redeploy).
 * Uses #581 transient health-fetch retry semantics against live production.
 * Classifies a prior deploy run as POST_PROMOTE_HEALTH_FETCH_TRANSIENT when
 * production already serves the frozen SHA healthy.
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
const PRIOR_DEPLOY_RUN_ID = "30558735412";

const PENDING_MIGRATIONS = [
  {
    version: "20260905120000",
    file: "20260905120000_phase17menu_package_entitlements_canonical.sql",
    required_for_frozen_sha: false,
    backward_compatible: true,
    already_in_production_schema: false,
    decision: "DEFER",
    rationale:
      "Freeze app dual-reads legacy entitlement keys; Melhus path works without canonical rewrite. Additive but not required for live SHA.",
  },
  {
    version: "20260906120000",
    file: "20260906120000_phase17menu1_enterprise_contracts_staging.sql",
    required_for_frozen_sha: false,
    backward_compatible: true,
    already_in_production_schema: false,
    decision: "DEFER",
    rationale:
      "Header marks PRODUCTION_MIGRATION=NOT_APPROVED / staging-first. provider_enterprise_contracts absent in prod and unused by frozen runtime.",
  },
  {
    version: "20260907120000",
    file: "20260907120000_phase17menu2d_atomic_capacity_commission.sql",
    required_for_frozen_sha: false,
    backward_compatible: true,
    already_in_production_schema: false,
    decision: "DEFER",
    rationale:
      "dish_day_capacity is opt-in (absence=unlimited). Not required for frozen NO Melhus golden path; staging-first.",
  },
  {
    version: "20260907130000",
    file: "20260907130000_phase17menu2d_commission_exact_writepath.sql",
    required_for_frozen_sha: false,
    backward_compatible: false,
    already_in_production_schema: false,
    decision: "DEFER",
    rationale:
      "Replaces commission ledger writepath (exact_numerator columns absent). Financial-path risk; not required for freeze SHA already live without it.",
  },
  {
    version: "20260908120000",
    file: "20260908120000_phase18scale_production_snapshots.sql",
    required_for_frozen_sha: false,
    backward_compatible: true,
    already_in_production_schema: false,
    decision: "DEFER",
    rationale:
      "provider_production_snapshots marked non-production-first/opt-in. Not required for frozen application SHA.",
  },
];

function buildDatabaseUrl() {
  const direct = String(process.env.DATABASE_URL || "").trim();
  if (direct && direct.includes(PROD_REF)) return direct;
  const ref = String(process.env.SUPABASE_PROD_PROJECT_REF || "").trim();
  const pw = String(process.env.SUPABASE_PROD_DB_PASSWORD || "").trim();
  if (!ref || !pw) return null;
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
}

async function waitForHealthSha(baseUrl, expectedSha, attempts = 48) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/health`;
  let last = null;
  const samples = [];
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      const version = String(body?.data?.version || body?.data?.release?.git_sha || "");
      const summary = String(body?.data?.summary?.status || "");
      last = version;
      samples.push({
        attempt: i + 1,
        ok: Boolean(res.ok && body?.ok),
        version,
        summary,
      });
      if (res.ok && body?.ok && version === expectedSha && summary === "ok") {
        return { ok: true, version, summary, attempt: i + 1, samples };
      }
    } catch (e) {
      last = `fetch_error:${String(e?.message || e).slice(0, 80)}`;
      samples.push({ attempt: i + 1, ok: false, version: null, summary: last });
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return { ok: false, version: last, summary: null, samples };
}

async function inspectDb(databaseUrl) {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  try {
    const head = await client.query(
      `select version from supabase_migrations.schema_migrations order by version desc limit 1`,
    );
    const pendingPresent = await client.query(
      `select version from supabase_migrations.schema_migrations
       where version = any($1::text[]) order by version`,
      [PENDING_MIGRATIONS.map((m) => m.version)],
    );
    const schemaPresence = await client.query(`
      select
        to_regclass('public.dish_day_capacity') is not null as dish_day_capacity,
        to_regclass('public.provider_enterprise_contracts') is not null as enterprise_contracts,
        to_regclass('public.provider_production_snapshots') is not null as prod_snapshots,
        exists(
          select 1 from information_schema.columns
          where table_schema='public' and table_name='commission_ledger'
            and column_name='exact_numerator'
        ) as commission_exact_numerator
    `);
    const ks = await client.query(
      `select global_cutover_allowed from public.global_activation_kill_switch where id=1`,
    );
    const enabled = await client.query(
      `select country_code from public.country_production_activation
       where production_enabled or registration_enabled or ordering_enabled
          or invoice_only_enabled or platform_commission_enabled
       order by country_code`,
    );
    const integrity = await client.query(`
      select
        (select count(*)::int from pg_policies where schemaname='public') as rls_policy_count,
        (select count(*)::int from public.orders) as orders_count,
        (select count(*)::int from public.orders where status = 'CANCELLED') as cancelled_orders_count,
        (select count(*)::int from public.commission_ledger) as commission_ledger_count,
        (select count(*)::int from public.orders where status in ('ACTIVE','PREPARED','DELIVERED','CANCELLED')) as orders_status_readable
    `);
    return {
      migration_head: head.rows[0]?.version || null,
      pending_applied_versions: pendingPresent.rows.map((r) => r.version),
      schema_presence: schemaPresence.rows[0] || {},
      global_cutover_allowed: ks.rows[0]?.global_cutover_allowed ?? null,
      countries_enabled: enabled.rows.map((r) => r.country_code),
      integrity: integrity.rows[0] || {},
    };
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const releaseSha = String(process.env.GLOBAL_RELEASE_SHA || FREEZE_SHA).trim();
  const priorRun = String(process.env.PRIOR_DEPLOY_RUN_ID || PRIOR_DEPLOY_RUN_ID).trim();
  const baseUrl = String(
    process.env.PROD_BASE_URL || process.env.APP_BASE_URL || "https://app.lunchportalen.no",
  ).trim();
  const healthAttempts = Number(process.env.HEALTH_VERIFY_ATTEMPTS || 6);

  const health = await waitForHealthSha(baseUrl, releaseSha, healthAttempts);
  const databaseUrl = buildDatabaseUrl();
  if (!databaseUrl) throw new Error("NO_DATABASE_URL");
  const db = await inspectDb(databaseUrl);

  const migrationDecisions = PENDING_MIGRATIONS.map((m) => ({
    ...m,
    already_in_production_schema:
      db.pending_applied_versions.includes(m.version) ||
      (m.version === "20260907120000" && db.schema_presence.dish_day_capacity) ||
      (m.version === "20260906120000" && db.schema_presence.enterprise_contracts) ||
      (m.version === "20260908120000" && db.schema_presence.prod_snapshots) ||
      (m.version === "20260907130000" && db.schema_presence.commission_exact_numerator),
    applied_this_run: false,
  }));

  const requiredToApply = migrationDecisions.filter(
    (m) => m.required_for_frozen_sha && m.backward_compatible && m.decision === "APPLY",
  );
  if (requiredToApply.length) {
    throw new Error(
      `REQUIRED_MIGRATIONS_NOT_APPLIED:${requiredToApply.map((m) => m.version).join(",")}`,
    );
  }

  const marketsOk =
    db.global_cutover_allowed === false &&
    db.countries_enabled.every((c) => c === "NO") &&
    db.countries_enabled.includes("NO");

  const integrityOk =
    Number(db.integrity.rls_policy_count || 0) > 0 &&
    db.migration_head === "20260904120000";

  const classify =
    health.ok && marketsOk && integrityOk
      ? {
          deploy_run_id: priorRun,
          classification: "POST_PROMOTE_HEALTH_FETCH_TRANSIENT",
          note: "Promote succeeded; GH failure was transient post-promote health fetch. Production telemetry healthy on freeze SHA.",
        }
      : {
          deploy_run_id: priorRun,
          classification: "UNCLASSIFIED_NEEDS_INVESTIGATION",
          note: "Live telemetry did not remain healthy/compatible; refusing transient classification.",
        };

  const result =
    health.ok && marketsOk && integrityOk && requiredToApply.length === 0 ? "PASS" : "FAIL";

  const report = {
    gate: "GLOBAL_PRODUCTION_POST_PROMOTE_VERIFY",
    result,
    GLOBAL_RELEASE_SHA: releaseSha,
    production_sha: health.version || null,
    production_health: health.ok ? "OK" : "FAIL",
    health_verify: {
      ok: health.ok,
      attempts_used: health.attempt || health.samples?.length || 0,
      summary: health.summary,
      retry_semantics: "main#581/4a7ef2a8 waitForHealthSha transient fetch retry",
    },
    deploy_classification: classify,
    migration_head_before: db.migration_head,
    migration_head_after: db.migration_head,
    migrations_applied_this_run: [],
    pending_migration_decisions: migrationDecisions,
    NEW_MARKETS_ENABLED: db.countries_enabled.filter((c) => c !== "NO").length,
    countries_enabled: db.countries_enabled,
    GLOBAL_CUTOVER_ALLOWED: db.global_cutover_allowed,
    integrity: db.integrity,
    schema_presence: db.schema_presence,
    stamped_at: new Date().toISOString(),
    note: "Verification only — no redeploy. Required BC migrations under lock: none for frozen SHA.",
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "GLOBAL-PRODUCTION-POST-PROMOTE-VERIFY.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));
  if (result !== "PASS") process.exit(1);
}

main().catch((e) => {
  const fatal = String(e?.message || e).slice(0, 240);
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, "GLOBAL-PRODUCTION-POST-PROMOTE-VERIFY.json"),
      `${JSON.stringify({
        gate: "GLOBAL_PRODUCTION_POST_PROMOTE_VERIFY",
        result: "FAIL",
        fatal,
        stamped_at: new Date().toISOString(),
      }, null, 2)}\n`,
      "utf8",
    );
  } catch {
    /* ignore */
  }
  console.error(JSON.stringify({ fatal }));
  process.exit(2);
});
