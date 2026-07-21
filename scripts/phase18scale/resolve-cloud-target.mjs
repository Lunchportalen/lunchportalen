#!/usr/bin/env node
/**
 * Resolve isolated Phase 18 Supabase target from Management API.
 * Never accepts production/shared-staging refs.
 *
 * PHASE18_DATABASE_URL uses Supavisor session-mode pooler (IPv4-capable).
 * Direct db.<ref>.supabase.co is IPv6-only and unreachable from GitHub-hosted runners.
 * Prints KEY=value lines suitable for $GITHUB_ENV (never prints plaintext password alone).
 */
import crypto from "node:crypto";
import dns from "node:dns/promises";

const PROD = "hkpokyapzarefrgqzkos";
const STAGING = "uigxsboqeruxflgzqztl";

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

const keysRes = await fetchJson(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!keysRes.ok) {
  console.error(`api-keys HTTP ${keysRes.status}`);
  process.exit(2);
}
const keys = Array.isArray(keysRes.body) ? keysRes.body : [];
const anon = keys.find((k) => k.name === "anon" || k.name === "publishable");
const service = keys.find((k) => k.name === "service_role" || k.name === "secret");
if (!anon?.api_key || !service?.api_key) {
  console.error("missing anon/service_role keys");
  process.exit(2);
}

const projRes = await fetchJson(`https://api.supabase.com/v1/projects/${ref}`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!projRes.ok) {
  console.error(`project HTTP ${projRes.status}`);
  process.exit(2);
}
const region = String(projRes.body?.region || "").trim();
if (!region || !/^[a-z0-9-]+$/i.test(region)) {
  console.error("project region missing/invalid");
  process.exit(2);
}

const url = `https://${ref}.supabase.co`;

// Ephemeral DB password for isolated load-cert only (never production/staging).
const dbPassword =
  process.env.PHASE18_DB_PASSWORD ||
  `P18c_${crypto.createHash("sha256").update(`phase18scale-db-${ref}`).digest("hex").slice(0, 28)}`;
const pwRes = await fetchJson(`https://api.supabase.com/v1/projects/${ref}/database/password`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ password: dbPassword }),
});
if (!pwRes.ok) {
  console.error(`database/password HTTP ${pwRes.status}`);
  process.exit(2);
}

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

const encoded = encodeURIComponent(dbPassword);
const user = `postgres.${ref}`;
// Session mode (5432): required for multi-statement repair scripts from GHA (IPv4).
const databaseUrl = `postgresql://${user}:${encoded}@${poolerHost}:5432/postgres?sslmode=require`;

const lines = [
  `PHASE18_LOAD_REF=${ref}`,
  `PHASE18_LOADCERT=1`,
  `PHASE18_DB_REGION=${region}`,
  `PHASE18_DB_CONNECTION_METHOD=supavisor_session_pooler_ipv4`,
  `PHASE18_DB_POOLER_HOST=${poolerHost}`,
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
