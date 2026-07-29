#!/usr/bin/env node
/**
 * Resolve isolated Phase 18 Supabase target from Management API.
 * Never accepts production/shared-staging refs.
 *
 * PHASE18_DATABASE_URL uses Supavisor session-mode pooler (IPv4-capable).
 * Direct db.<ref>.supabase.co is IPv6-only and unreachable from GitHub-hosted runners.
 *
 * Password policy:
 * - Prefer PHASE18_DB_PASSWORD secret when set.
 * - Otherwise use deterministic isolated password.
 * - Do NOT rotate via Management API on every job (causes pooler auth races).
 * - Rotate only when probe auth fails, then verify with retries.
 *
 * Prints KEY=value lines suitable for $GITHUB_ENV (never prints plaintext password alone).
 */
import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { isAuthFailure, isTransientPoolerError } from "./lib/pooler-auth-errors.mjs";

const PROD = "hkpokyapzarefrgqzkos";
const STAGING = "uigxsboqeruxflgzqztl";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CA_BUNDLE = path.join(__dirname, "certs/supabase-pooler-ca-bundle.crt");

const ref = String(process.env.PHASE18_LOAD_REF || process.argv[2] || "").trim();
const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();

if (!ref) {
  console.error("PHASE18_LOAD_REF required");
  process.exit(2);
}
if (ref === PROD || ref === STAGING) {
  console.error("forbidden ref");
  process.exit(2);
}
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN required");
  process.exit(2);
}
if (ref.includes(PROD) || ref.includes(STAGING)) {
  console.error("forbidden ref fragment");
  process.exit(2);
}


async function fetchProjectOrThrow() {
  const projRes = await fetchJson(`https://api.supabase.com/v1/projects/${ref}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!projRes.ok) {
    if (projRes.status === 404 || projRes.status === 400) {
      console.error(`PHASE18_PROJECT_NOT_FOUND: project HTTP ${projRes.status}`);
    } else {
      console.error(`project HTTP ${projRes.status}`);
    }
    process.exit(2);
  }
  const status = String(projRes.body?.status || "").toLowerCase();
  if (status && !["active_healthy", "active_unhealthy", "coming_up"].includes(status)) {
    console.error(`PHASE18_PROJECT_NOT_ACTIVE: status=${status || "unknown"}`);
    process.exit(2);
  }
  return projRes;
}

async function fetchApiKeysWithRetry() {
  let last = { ok: false, status: 0, body: null };
  for (let attempt = 1; attempt <= 4; attempt++) {
    last = await fetchJson(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (last.ok) return last;
    if (last.status === 404 || (last.status === 400 && attempt >= 2)) {
      console.error(`PHASE18_PROJECT_NOT_FOUND: api-keys HTTP ${last.status}`);
      process.exit(2);
    }
    console.error(JSON.stringify({ phase18_api_keys_retry: { attempt, status: last.status } }));
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  console.error(`api-keys HTTP ${last.status}`);
  process.exit(2);
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

function buildDatabaseUrl(user, password, host) {
  const encoded = encodeURIComponent(password);
  return `postgresql://${user}:${encoded}@${host}:5432/postgres?sslmode=require`;
}

async function probePoolerAuth(databaseUrl) {
  if (!fs.existsSync(CA_BUNDLE)) {
    return { ok: false, error: "PHASE18_SUPABASE_CA_MISSING" };
  }
  const ca = fs.readFileSync(CA_BUNDLE, "utf8");
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return { ok: false, error: "PHASE18_DB_URL_INVALID" };
  }
  parsed.searchParams.delete("sslmode");
  const client = new pg.Client({
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: true, ca, minVersion: "TLSv1.2" },
    // Concurrent jobs + intermittent pooler stalls (run 30198105720: 6× timeout).
    connectionTimeoutMillis: 45000,
  });
  try {
    await client.connect();
    const r = await client.query("select 1::int as n");
    if (Number(r.rows[0]?.n) !== 1) return { ok: false, error: "SELECT_1_FAILED" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

async function probePoolerAuthWithRetries(
  databaseUrl,
  { attempts = 10, label = "probe", retryAuthFailures = false } = {},
) {
  let last = { ok: false, error: "not_probed" };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    last = await probePoolerAuth(databaseUrl);
    if (last.ok) return last;
    const authFail = isAuthFailure(last.error);
    // Auth failures are terminal for normal probes (that triggers rotate).
    // After Management API rotate, Supavisor can keep serving the old password
    // for tens of seconds — retry auth there instead of failing closed on attempt 1.
    if (authFail && !retryAuthFailures) return last;
    if (!authFail && !isTransientPoolerError(last.error) && attempt >= 2) return last;
    console.error(
      JSON.stringify({
        phase18_pooler_probe_retry: {
          label,
          attempt,
          attempts,
          error: last.error,
          auth_failure: authFail,
          transient: isTransientPoolerError(last.error),
          retry_auth: retryAuthFailures,
        },
      }),
    );
    // Cap auth backoff so post-rotate settle stays inside the job timeout.
    await new Promise((r) => setTimeout(r, authFail ? Math.min(8000, 3000 * attempt) : 2500 * attempt));
  }
  return last;
}

async function rotateDatabasePassword(password) {
  const pwRes = await fetchJson(`https://api.supabase.com/v1/projects/${ref}/database/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  return pwRes;
}

const projRes = await fetchProjectOrThrow();
const keysRes = await fetchApiKeysWithRetry();
const keys = Array.isArray(keysRes.body) ? keysRes.body : [];
const anon = keys.find((k) => k.name === "anon" || k.name === "publishable");
const service = keys.find((k) => k.name === "service_role" || k.name === "secret");
if (!anon?.api_key || !service?.api_key) {
  console.error("missing anon/service_role keys");
  process.exit(2);
}
const region = String(projRes.body?.region || "").trim();
if (!region || !/^[a-z0-9-]+$/i.test(region)) {
  console.error("project region missing/invalid");
  process.exit(2);
}

const url = `https://${ref}.supabase.co`;

const dbPassword =
  process.env.PHASE18_DB_PASSWORD ||
  `P18c_${crypto.createHash("sha256").update(`phase18scale-db-${ref}`).digest("hex").slice(0, 28)}`;

const poolerCandidates = [
  `aws-0-${region}.pooler.supabase.com`,
  `aws-${region}.pooler.supabase.com`,
];

let poolerHost = null;
for (const host of poolerCandidates) {
  try {
    const v4 = await dns.resolve4(host);
    if (Array.isArray(v4) && v4.length > 0) {
      poolerHost = host;
      break;
    }
  } catch {
    /* try next candidate */
  }
}
if (!poolerHost) {
  console.error(`PHASE18_POOLER_DNS_FAILED region=${region}`);
  process.exit(2);
}

const user = `postgres.${ref}`;
let databaseUrl = buildDatabaseUrl(user, dbPassword, poolerHost);
let passwordAction = "reused_existing";

const forceRotate = ["1", "true", "yes"].includes(
  String(process.env.PHASE18_ROTATE_DB_PASSWORD || process.env.PHASE18_FORCE_INITIAL_ROTATE || "").toLowerCase(),
);

// Retry transient pooler timeouts before any Management API password rotate.
// Concurrent auth-session-issue shards (run #43 shard 3) hit "timeout expired";
// rotating on timeout races other shards and worsens pooler auth.
let probe = { ok: false, error: "not_probed" };
if (!forceRotate) {
  probe = await probePoolerAuthWithRetries(databaseUrl, {
    attempts: 10,
    label: "initial",
  });
}
const shouldRotate =
  forceRotate || (!probe.ok && isAuthFailure(probe.error));

if (shouldRotate) {
  const pwRes = await rotateDatabasePassword(dbPassword);
  if (!pwRes.ok) {
    console.error(`database/password HTTP ${pwRes.status}`);
    process.exit(2);
  }
  passwordAction = forceRotate ? "forced_rotate" : "rotated_after_auth_fail";
  databaseUrl = buildDatabaseUrl(user, dbPassword, poolerHost);
  // New projects restart DB auth after Management API rotate; Supavisor lag is common.
  const settleMs = forceRotate ? 25000 : 12000;
  console.error(JSON.stringify({ phase18_password_rotate_settle_ms: settleMs, action: passwordAction }));
  await new Promise((r) => setTimeout(r, settleMs));

  probe = await probePoolerAuthWithRetries(databaseUrl, {
    attempts: 16,
    label: "post_rotate",
    retryAuthFailures: true,
  });

  // One more rotate+settle if the first password still has not propagated.
  if (!probe.ok && isAuthFailure(probe.error)) {
    const pwRes2 = await rotateDatabasePassword(dbPassword);
    if (!pwRes2.ok) {
      console.error(`database/password HTTP ${pwRes2.status} (second rotate)`);
      process.exit(2);
    }
    passwordAction = `${passwordAction}+retry_rotate`;
    databaseUrl = buildDatabaseUrl(user, dbPassword, poolerHost);
    console.error(JSON.stringify({ phase18_password_rotate_settle_ms: 30000, action: passwordAction }));
    await new Promise((r) => setTimeout(r, 30000));
    probe = await probePoolerAuthWithRetries(databaseUrl, {
      attempts: 16,
      label: "post_rotate_retry",
      retryAuthFailures: true,
    });
  }
}

if (!probe.ok) {
  console.error(`PHASE18_POOLER_AUTH_PROBE_FAILED: ${probe.error || "unknown"}`);
  process.exit(2);
}

// Redacted operational signal only (no password).
console.error(
  JSON.stringify({
    phase18_resolve_cloud_target: {
      ref,
      region,
      pooler_host: poolerHost,
      connection_method: "supavisor_session_pooler_ipv4",
      password_action: passwordAction,
      auth_probe: "PASS",
      tls: "rejectUnauthorized=true,ca=supabase-pooler-ca-bundle.crt",
    },
  }),
);

const lines = [
  `PHASE18_LOAD_REF=${ref}`,
  `PHASE18_LOADCERT=1`,
  `PHASE18_DB_REGION=${region}`,
  `PHASE18_DB_CONNECTION_METHOD=supavisor_session_pooler_ipv4`,
  `PHASE18_DB_POOLER_HOST=${poolerHost}`,
  `PHASE18_DB_PASSWORD_ACTION=${passwordAction}`,
  `NEXT_PUBLIC_SUPABASE_URL=${url}`,
  `SUPABASE_URL=${url}`,
  `PHASE18_SUPABASE_URL=${url}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon.api_key}`,
  `SUPABASE_ANON_KEY=${anon.api_key}`,
  `PHASE18_SUPABASE_ANON_KEY=${anon.api_key}`,
  `SUPABASE_SERVICE_ROLE_KEY=${service.api_key}`,
  `PHASE18_SUPABASE_SERVICE_ROLE_KEY=${service.api_key}`,
  `PHASE18_DATABASE_URL=${databaseUrl}`,
  `PHASE18_ALLOW_STAGING_ISOLATION=0`,
];
for (const line of lines) console.log(line);
