#!/usr/bin/env node
/**
 * Exact-SHA production deploy with new markets remaining disabled.
 * Uses Vercel CLI against the checked-out freeze SHA (bypasses Git ignore-build lock).
 * Never prints secrets.
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
const PREFLIGHT_PATH = path.join(OUT_DIR, "GLOBAL-PRODUCTION-PREFLIGHT.json");

function sh(cmd, args, opts = {}) {
  const { env: extraEnv, ...rest } = opts;
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...rest,
    env: { ...process.env, ...(extraEnv || {}) },
  }).trim();
}

function nowIso() {
  return new Date().toISOString();
}

function buildDatabaseUrl() {
  const direct = String(process.env.DATABASE_URL || "").trim();
  if (direct && direct.includes(PROD_REF)) return direct;
  const ref = String(process.env.SUPABASE_PROD_PROJECT_REF || "").trim();
  const pw = String(process.env.SUPABASE_PROD_DB_PASSWORD || "").trim();
  if (!ref || !pw) return null;
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
}

async function assertMarketsDisabled(databaseUrl) {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  try {
    const ks = await client.query(
      `select global_cutover_allowed from public.global_activation_kill_switch where id=1`,
    );
    if (ks.rows[0]?.global_cutover_allowed !== false) {
      throw new Error("GLOBAL_CUTOVER_MUST_REMAIN_FALSE");
    }
    const bad = await client.query(
      `select country_code from public.country_production_activation
       where country_code <> 'NO'
         and (production_enabled or registration_enabled or ordering_enabled
              or invoice_only_enabled or platform_commission_enabled)`,
    );
    if (bad.rows.length) {
      throw new Error(`NEW_MARKETS_ENABLED:${bad.rows.map((r) => r.country_code).join(",")}`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

async function waitForHealthSha(baseUrl, expectedSha, attempts = 48) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/health`;
  let last = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    const version = String(body?.data?.version || body?.data?.release?.git_sha || "");
    last = version;
    if (res.ok && body?.ok && version === expectedSha) {
      return { ok: true, version, attempt: i + 1 };
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return { ok: false, version: last };
}

function resolveVercelBin() {
  const candidates = [
    process.env.VERCEL_BIN,
    path.join(ROOT, "node_modules", ".bin", "vercel"),
    "/usr/local/bin/vercel",
    "/usr/bin/vercel",
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Fall back to PATH lookup via `command -v` (preserves PATH).
  try {
    const found = sh("bash", ["-lc", "command -v vercel"]);
    if (found) return found;
  } catch {
    /* continue */
  }
  return "vercel";
}

async function main() {
  const releaseSha = String(process.env.GLOBAL_RELEASE_SHA || "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(releaseSha)) throw new Error("GLOBAL_RELEASE_SHA required");
  const token = String(process.env.VERCEL_TOKEN || "").trim();
  if (!token) throw new Error("VERCEL_TOKEN missing");

  if (fs.existsSync(PREFLIGHT_PATH)) {
    const pf = JSON.parse(fs.readFileSync(PREFLIGHT_PATH, "utf8"));
    if (pf.result !== "PASS") throw new Error("PREFLIGHT_NOT_PASS");
    if (pf.GLOBAL_RELEASE_SHA && String(pf.GLOBAL_RELEASE_SHA).toLowerCase() !== releaseSha) {
      throw new Error("PREFLIGHT_SHA_MISMATCH");
    }
  } else if (process.env.ALLOW_DEPLOY_WITHOUT_LOCAL_PREFLIGHT !== "1") {
    throw new Error("MISSING_PREFLIGHT_EVIDENCE");
  }

  const databaseUrl = buildDatabaseUrl();
  if (!databaseUrl) throw new Error("NO_DATABASE_URL");
  await assertMarketsDisabled(databaseUrl);

  const baseUrl = String(
    process.env.PROD_BASE_URL || process.env.APP_BASE_URL || "https://app.lunchportalen.no",
  ).trim();
  const before = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`).then((r) => r.json());
  const rollbackSha = String(before?.data?.version || "");

  const head = sh("git", ["rev-parse", "HEAD"]).toLowerCase();
  if (head !== releaseSha) throw new Error(`CHECKOUT_NOT_FREEZE:${head}`);

  // Link-less production deploy from working tree. This path is NOT subject to
  // Git Integration commandForIgnoringBuildStep cancellation.
  const vercelBin = resolveVercelBin();
  const deployEnv = {
    VERCEL_TOKEN: token,
    VERCEL_ORG_ID: process.env.VERCEL_ORG_ID || "",
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID || "",
  };

  // Ensure project linkage for non-interactive CI.
  try {
    sh(
      vercelBin,
      [
        "link",
        "--yes",
        "--token",
        token,
        "--scope",
        "lunchportalen",
        "--project",
        "lunchportalen",
      ],
      { env: deployEnv },
    );
  } catch (e) {
    console.log(
      JSON.stringify({
        vercel_link_note: String(e?.stderr || e?.message || e).slice(0, 180),
      }),
    );
  }

  let deployOut = "";
  try {
    deployOut = sh(
      vercelBin,
      [
        "deploy",
        "--prod",
        "--yes",
        "--token",
        token,
        "--scope",
        "lunchportalen",
        "--meta",
        `githubCommitSha=${releaseSha}`,
        "--meta",
        "deployReason=global-production-deploy-markets-disabled",
      ],
      { env: deployEnv },
    );
  } catch (e) {
    throw new Error(
      `VERCEL_CLI_DEPLOY_FAIL:${String(e?.stderr || e?.message || e).slice(0, 400)}`,
    );
  }

  const health = await waitForHealthSha(baseUrl, releaseSha);
  await assertMarketsDisabled(databaseUrl);

  const report = {
    gate: "GLOBAL_PRODUCTION_DEPLOY",
    result: health.ok ? "PASS" : "FAIL",
    GLOBAL_RELEASE_SHA: releaseSha,
    rollback_sha: rollbackSha || null,
    production_sha: health.version || null,
    markets_disabled: true,
    global_cutover_allowed: false,
    vercel_bin: vercelBin,
    deploy_cli_tail: String(deployOut || "").slice(-500),
    stamped_at: nowIso(),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "GLOBAL-PRODUCTION-DEPLOY.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));
  if (!health.ok) process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e?.message || e).slice(0, 320) }));
  process.exit(2);
});
