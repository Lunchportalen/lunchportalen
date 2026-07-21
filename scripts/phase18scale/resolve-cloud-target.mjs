#!/usr/bin/env node
/**
 * Resolve isolated Phase 18 Supabase target from Management API.
 * Never accepts production/shared-staging refs.
 * Prints KEY=value lines suitable for $GITHUB_ENV (secrets masked by caller).
 */
import crypto from "node:crypto";

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

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error(`api-keys HTTP ${res.status}`);
  process.exit(2);
}
const keys = await res.json();
const anon = keys.find((k) => k.name === "anon" || k.name === "publishable");
const service = keys.find((k) => k.name === "service_role" || k.name === "secret");
if (!anon?.api_key || !service?.api_key) {
  console.error("missing anon/service_role keys");
  process.exit(2);
}

const url = `https://${ref}.supabase.co`;

// Ephemeral DB password for isolated load-cert only (never production/staging).
const dbPassword =
  process.env.PHASE18_DB_PASSWORD ||
  `P18c_${crypto.createHash("sha256").update(`phase18scale-db-${ref}`).digest("hex").slice(0, 28)}`;
const pwRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/password`, {
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

const encoded = encodeURIComponent(dbPassword);
const databaseUrl = `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres?sslmode=require`;

const lines = [
  `PHASE18_LOAD_REF=${ref}`,
  `PHASE18_LOADCERT=1`,
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
