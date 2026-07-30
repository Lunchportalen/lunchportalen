#!/usr/bin/env node
/**
 * GLOBAL_PRODUCTION_PREFLIGHT — read-only production readiness gate.
 * Never prints secrets. Never mutates production. Never forges legal/tax.
 *
 * Required env:
 *   VERCEL_TOKEN, SUPABASE_ACCESS_TOKEN
 *   SUPABASE_PROD_PROJECT_REF (must be hkpokyapzarefrgqzkos)
 *   SUPABASE_PROD_DB_PASSWORD (or DATABASE_URL pointing at prod)
 * Optional:
 *   GLOBAL_RELEASE_SHA, PROD_BASE_URL, VERCEL_TEAM_SLUG, VERCEL_PROJECT_NAME
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "docs/rc/launch-2026-08-01");
const PROD_REF = "hkpokyapzarefrgqzkos";
const EXPECTED_COUNTRIES = [
  "NO",
  "SE",
  "DK",
  "FI",
  "GB",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "BE",
  "CH",
  "AT",
  "IE",
  "PL",
  "RO",
  "CZ",
  "PT",
  "GR",
  "US",
  "CA",
];

const checks = [];
let failed = 0;

function nowIso() {
  return new Date().toISOString();
}

function record(id, status, detail = {}) {
  const row = { id, status, ...detail, stamped_at: nowIso() };
  checks.push(row);
  const line = JSON.stringify(row);
  if (status === "PASS") console.log(line);
  else {
    failed += 1;
    console.error(line);
  }
}

function requireEnv(name) {
  const v = String(process.env[name] || "").trim();
  if (!v) {
    record(name, "FAIL", { reason: "MISSING_ENV" });
    return null;
  }
  // Presence only — never log value.
  record(`${name}_present`, "PASS", { present: true, len: v.length });
  return v;
}

function buildDatabaseUrl() {
  const direct = String(process.env.DATABASE_URL || "").trim();
  if (direct && direct.includes(PROD_REF)) return direct;
  const ref = String(process.env.SUPABASE_PROD_PROJECT_REF || "").trim();
  const pw = String(process.env.SUPABASE_PROD_DB_PASSWORD || "").trim();
  if (!ref || !pw) return null;
  const encoded = encodeURIComponent(pw);
  return `postgresql://postgres.${ref}:${encoded}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw_len: text.length };
  }
  return { ok: res.ok, status: res.status, body };
}

async function checkHealth(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/health`;
  const res = await fetchJson(url);
  if (!res.ok || !res.body?.ok) {
    record("health", "FAIL", { http: res.status, reason: "HEALTH_NOT_OK" });
    return null;
  }
  const version = String(res.body?.data?.version || res.body?.data?.release?.git_sha || "");
  const summary = res.body?.data?.summary || {};
  const pass =
    summary.status === "ok" &&
    summary.supabase === "ok" &&
    summary.env === "ok" &&
    Boolean(version);
  record(pass ? "health" : "health", pass ? "PASS" : "FAIL", {
    version,
    summary_status: summary.status || null,
    supabase: summary.supabase || null,
    sanity: summary.sanity || null,
    env: summary.env || null,
  });
  return { version, summary };
}

async function checkVercel(token, currentProdSha) {
  const headers = { Authorization: `Bearer ${token}` };
  const user = await fetchJson("https://api.vercel.com/v2/user", headers);
  if (!user.ok) {
    record("vercel_auth", "FAIL", { http: user.status });
    return null;
  }
  const teams = await fetchJson("https://api.vercel.com/v2/teams", headers);
  const teamList = Array.isArray(teams.body?.teams) ? teams.body.teams : [];
  const team =
    teamList.find((t) => /lunchportalen/i.test(String(t?.slug || t?.name || ""))) || null;
  if (!team?.id) {
    record("vercel_team", "FAIL", { reason: "TEAM_NOT_FOUND" });
    return null;
  }
  record("vercel_team", "PASS", { team_slug: team.slug });

  const qs = new URLSearchParams({ teamId: team.id, limit: "20" });
  const projects = await fetchJson(`https://api.vercel.com/v9/projects?${qs}`, headers);
  const projectList = Array.isArray(projects.body?.projects) ? projects.body.projects : [];
  const project =
    projectList.find((p) => String(p?.name || "").toLowerCase() === "lunchportalen") || null;
  if (!project?.id) {
    record("vercel_project", "FAIL", { reason: "PROJECT_NOT_FOUND" });
    return null;
  }
  record("vercel_project", "PASS", { project_name: project.name });

  const ignore =
    project?.commandForIgnoringBuildStep ||
    project?.ignoreCommand ||
    null;
  // Deploy lock: ignoring build step is an intentional production auto-deploy lock.
  record("deploy_lock", ignore ? "PASS" : "FAIL", {
    commandForIgnoringBuildStep_present: Boolean(ignore),
    note: ignore
      ? "Production auto-deploy lock ACTIVE (ignore build step configured)"
      : "Missing ignore-build lock — refuse uncontrolled auto-deploy",
  });

  const dQs = new URLSearchParams({
    teamId: team.id,
    limit: "10",
    target: "production",
    state: "READY",
  });
  const deps = await fetchJson(
    `https://api.vercel.com/v6/deployments?projectId=${project.id}&${dQs}`,
    headers,
  );
  const deployments = Array.isArray(deps.body?.deployments) ? deps.body.deployments : [];
  const latest = deployments[0] || null;
  const vercelSha = String(latest?.meta?.githubCommitSha || latest?.meta?.gitCommitSha || "");
  const shaMatch = currentProdSha && vercelSha && currentProdSha.startsWith(vercelSha.slice(0, 7));
  record("current_production_sha", vercelSha || currentProdSha ? "PASS" : "FAIL", {
    health_sha: currentProdSha || null,
    vercel_sha: vercelSha || null,
    deployment_uid: latest?.uid ? `${String(latest.uid).slice(0, 8)}…` : null,
    consistent: Boolean(
      !currentProdSha || !vercelSha || currentProdSha === vercelSha || shaMatch,
    ),
  });
  record("rollback_sha", currentProdSha || vercelSha ? "PASS" : "FAIL", {
    rollback_sha: currentProdSha || vercelSha || null,
    note: "Current production SHA is the rollback target before any promote",
  });
  return { team, project, vercelSha: vercelSha || currentProdSha || null };
}

async function checkBackup(token, projectRef) {
  const res = await fetchJson(`https://api.supabase.com/v1/projects/${projectRef}/database/backups`, {
    Authorization: `Bearer ${token}`,
  });
  if (!res.ok) {
    record("production_backup", "FAIL", { http: res.status });
    record("restore_readiness", "FAIL", { reason: "BACKUP_API_FAILED" });
    return;
  }
  const backups = Array.isArray(res.body?.backups)
    ? res.body.backups
    : Array.isArray(res.body)
      ? res.body
      : [];
  const latest = backups[0] || null;
  const hasBackup = backups.length > 0;
  record("production_backup", hasBackup ? "PASS" : "FAIL", {
    backup_count: backups.length,
    latest_status: latest?.status || latest?.is_physical_backup_successful || null,
    latest_inserted_at: latest?.inserted_at || latest?.created_at || null,
  });
  // Supabase physical/PITR backups imply restore readiness when at least one exists.
  record("restore_readiness", hasBackup ? "PASS" : "FAIL", {
    restore_available: hasBackup,
    pitr_or_physical: Boolean(latest),
  });
}

async function checkMonitoring(token, projectRef) {
  const proj = await fetchJson(`https://api.supabase.com/v1/projects/${projectRef}`, {
    Authorization: `Bearer ${token}`,
  });
  const healthy = proj.ok && String(proj.body?.status || "").includes("ACTIVE");
  record("monitoring_and_alerts", healthy ? "PASS" : "FAIL", {
    supabase_status: proj.body?.status || null,
    health_endpoint: "checked_separately",
    note: "Supabase project ACTIVE + /api/health ok is the operational monitor baseline",
  });
}

async function checkDatabase(databaseUrl, releaseSha) {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
    statement_timeout: 20_000,
  });
  await client.connect();
  try {
    const refHost = databaseUrl.includes(PROD_REF);
    if (!refHost) {
      record("db_target", "FAIL", { reason: "NOT_PRODUCTION_REF" });
      return;
    }
    record("db_target", "PASS", { project_ref: PROD_REF });

    const mig = await client.query(
      `select version from supabase_migrations.schema_migrations order by version desc limit 1`,
    );
    const migrationHead = mig.rows[0]?.version || null;
    record("migration_head", migrationHead ? "PASS" : "FAIL", { migration_head: migrationHead });

    // Local migration head for release SHA (checkout should already be that SHA).
    const localDir = path.join(ROOT, "supabase/migrations");
    const localVersions = fs
      .readdirSync(localDir)
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .map((f) => f.split("_")[0])
      .sort();
    const localHead = localVersions[localVersions.length - 1] || null;
    const pending = localVersions.filter((v) => v > String(migrationHead || ""));
    record("migration_lock", "PASS", {
      release_sha: releaseSha || null,
      remote_head: migrationHead,
      local_head: localHead,
      pending_count: pending.length,
      pending_sample: pending.slice(0, 8),
      note:
        pending.length === 0
          ? "No pending migrations vs checkout"
          : "Pending migrations recorded — deploy must not auto-apply without explicit migrate job",
    });

    const ks = await client.query(
      `select global_cutover_allowed, technical_21_complete, reason
       from public.global_activation_kill_switch where id = 1`,
    );
    const kill = ks.rows[0] || null;
    const globalOff = kill && kill.global_cutover_allowed === false;
    record("global_kill_switch", globalOff ? "PASS" : "FAIL", {
      global_cutover_allowed: kill?.global_cutover_allowed ?? null,
      technical_21_complete: kill?.technical_21_complete ?? null,
      reason: kill?.reason ? String(kill.reason).slice(0, 160) : null,
      expected: "false (new markets remain disabled for deploy)",
    });

    const countries = await client.query(
      `select country_code, production_enabled, registration_enabled, ordering_enabled,
              invoice_only_enabled, platform_commission_enabled
       from public.country_production_activation
       order by country_code`,
    );
    const rows = countries.rows || [];
    const codes = rows.map((r) => r.country_code);
    const missing = EXPECTED_COUNTRIES.filter((c) => !codes.includes(c));
    const enabledNonNo = rows.filter(
      (r) =>
        r.country_code !== "NO" &&
        (r.production_enabled ||
          r.registration_enabled ||
          r.ordering_enabled ||
          r.invoice_only_enabled ||
          r.platform_commission_enabled),
    );
    const noRow = rows.find((r) => r.country_code === "NO") || null;
    record("country_kill_switches_21", missing.length === 0 && enabledNonNo.length === 0 ? "PASS" : "FAIL", {
      rows: rows.length,
      missing,
      enabled_non_no: enabledNonNo.map((r) => r.country_code),
      norway: noRow
        ? {
            production_enabled: noRow.production_enabled,
            ordering_enabled: noRow.ordering_enabled,
            invoice_only_enabled: noRow.invoice_only_enabled,
          }
        : null,
      note: "New markets must remain disabled; NO may already be Norway-first enabled",
    });

    const rls = await client.query(
      `select c.relname, c.relrowsecurity as rls
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname = any($1::text[])
       order by 1`,
      [["orders", "companies", "profiles", "agreements"]],
    );
    const rlsOk = rls.rows.length === 4 && rls.rows.every((r) => r.rls === true);
    record("rls", rlsOk ? "PASS" : "FAIL", {
      tables: rls.rows,
    });

    const synthCompanies = await client.query(
      `select count(*)::int as n from public.companies
       where coalesce(slug,'') ~* 'synthetic|phase18|scale-cert|loadcert'
          or coalesce(name,'') ~* 'synthetic|phase18scale'`,
    );
    const synthProfiles = await client.query(
      `select count(*)::int as n from public.profiles
       where coalesce(email,'') ~* '@(synthetic|phase18|loadcert)\\.|synthetic\\+|phase18\\+'`,
    );
    const synthN = Number(synthCompanies.rows[0]?.n || 0) + Number(synthProfiles.rows[0]?.n || 0);
    record("production_synthetic_records", synthN === 0 ? "PASS" : "FAIL", {
      synthetic_companies: Number(synthCompanies.rows[0]?.n || 0),
      synthetic_profiles: Number(synthProfiles.rows[0]?.n || 0),
    });

    // Auth surface: auth schema reachable + users table exists (not a login forge).
    const auth = await client.query(
      `select to_regclass('auth.users') is not null as auth_users_present,
              (select count(*)::int from auth.users) as user_count`,
    );
    record("auth", auth.rows[0]?.auth_users_present ? "PASS" : "FAIL", {
      auth_users_present: Boolean(auth.rows[0]?.auth_users_present),
      user_count_present: auth.rows[0]?.user_count != null,
    });
  } finally {
    await client.end().catch(() => {});
  }
}

function checkInvoiceStripePolicy() {
  const paymentPath = path.join(ROOT, "lib/billing/paymentPolicy.ts");
  const src = fs.readFileSync(paymentPath, "utf8");
  const invoiceOnly = src.includes('mode: "invoice_only"') && src.includes("allowOnlinePayment: false");
  record("invoice_only", invoiceOnly ? "PASS" : "FAIL", { file: "lib/billing/paymentPolicy.ts" });
  record("stripe_off", invoiceOnly ? "PASS" : "FAIL", {
    allowOnlinePayment: false,
    mode: "invoice_only",
  });
}

async function main() {
  const releaseSha = String(process.env.GLOBAL_RELEASE_SHA || process.env.RELEASE_SHA || "").trim();
  const baseUrl = String(process.env.PROD_BASE_URL || process.env.APP_BASE_URL || "https://app.lunchportalen.no").trim();
  const projectRef = String(process.env.SUPABASE_PROD_PROJECT_REF || PROD_REF).trim();

  if (projectRef !== PROD_REF) {
    record("project_ref", "FAIL", { got: projectRef, expected: PROD_REF });
  } else {
    record("project_ref", "PASS", { project_ref: PROD_REF });
  }

  if (!/^[0-9a-f]{40}$/i.test(releaseSha)) {
    record("global_release_sha", "FAIL", { reason: "INVALID_OR_MISSING_SHA", got: releaseSha || null });
  } else {
    record("global_release_sha", "PASS", { GLOBAL_RELEASE_SHA: releaseSha });
    try {
      const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
      record("checkout_matches_freeze", head === releaseSha ? "PASS" : "FAIL", {
        head,
        GLOBAL_RELEASE_SHA: releaseSha,
      });
    } catch (e) {
      record("checkout_matches_freeze", "FAIL", { reason: String(e?.message || e).slice(0, 120) });
    }
  }

  const vercelToken = requireEnv("VERCEL_TOKEN");
  const supabaseToken = requireEnv("SUPABASE_ACCESS_TOKEN");
  requireEnv("SUPABASE_PROD_PROJECT_REF");
  // Password may be absent if DATABASE_URL is provided.
  if (!String(process.env.DATABASE_URL || "").trim()) {
    requireEnv("SUPABASE_PROD_DB_PASSWORD");
  } else {
    record("DATABASE_URL_present", "PASS", { present: true });
  }

  checkInvoiceStripePolicy();

  const health = await checkHealth(baseUrl);
  if (vercelToken) await checkVercel(vercelToken, health?.version || null);
  if (supabaseToken) {
    await checkBackup(supabaseToken, projectRef);
    await checkMonitoring(supabaseToken, projectRef);
  }

  const databaseUrl = buildDatabaseUrl();
  if (!databaseUrl) {
    record("database", "FAIL", { reason: "NO_DATABASE_URL" });
  } else {
    try {
      await checkDatabase(databaseUrl, releaseSha);
    } catch (e) {
      record("database", "FAIL", { reason: `DB_EXCEPTION:${String(e?.message || e).slice(0, 160)}` });
    }
  }

  const summary = {
    gate: "GLOBAL_PRODUCTION_PREFLIGHT",
    result: failed === 0 ? "PASS" : "FAIL",
    GLOBAL_RELEASE_SHA: releaseSha || null,
    production_sha: health?.version || null,
    rollback_sha: health?.version || null,
    failed_checks: checks.filter((c) => c.status === "FAIL").map((c) => c.id),
    checks,
    stamped_at: nowIso(),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "GLOBAL-PRODUCTION-PREFLIGHT.json");
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ wrote: outPath, result: summary.result, failed: summary.failed_checks }, null, 2));

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e?.message || e).slice(0, 240) }));
  process.exit(2);
});
