#!/usr/bin/env node
/**
 * PR-X1 Fase 4.5b — provision smoke-test user + merge .env.local keys.
 * Uses staging Supabase Admin API + MCP-completed SQL via inline fetch/SQL file output.
 * Run: node scripts/smoke/provision-smoke-user.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const EMAIL = "smoke-test@lunchportalen.no";
const COMPANY_ID = "8b0b8fa4-8d89-4795-b92b-e09129dd635f";
const LOCATION_ID = "f319b299-8914-4c52-9984-569ce07c914d";
const COMPANY_NAME = "Company A (agreements-test)";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function mergeEnvLocal(updates) {
  const file = path.join(process.cwd(), ".env.local");
  const existing = loadEnvFile(file);
  const merged = { ...existing, ...updates };
  const lines = Object.entries(merged).map(([k, v]) => {
    const needsQuote = /[\s#"'\\]/.test(v);
    return `${k}=${needsQuote ? JSON.stringify(v) : v}`;
  });
  fs.writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
}

async function adminFetch(url, serviceKey, method, body) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function resetPassword(url, serviceKey, userId, password) {
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password, email_confirm: true }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function findUserByEmail(url, serviceKey, email) {
  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  const json = await res.json();
  const users = json?.users ?? [];
  return users.find((u) => String(u.email ?? "").toLowerCase() === email.toLowerCase()) ?? null;
}

async function createUser(url, serviceKey, email, password) {
  return adminFetch(url, serviceKey, "POST", {
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Smoke Test" },
  });
}

async function verifyLogin(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function main() {
  const env = { ...loadEnvFile(".env.local"), ...process.env };
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url.includes("uigxsboqeruxflgzqztl")) {
    console.error("NEXT_PUBLIC_SUPABASE_URL must point to staging uigxsboqeruxflgzqztl");
    process.exit(1);
  }
  if (!serviceKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
    process.exit(1);
  }
  if (!anonKey) {
    console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing in .env.local");
    process.exit(1);
  }

  const password = crypto.randomBytes(24).toString("base64url");
  let user = await findUserByEmail(url, serviceKey, EMAIL);

  if (!user) {
    const created = await createUser(url, serviceKey, EMAIL, password);
    if (created.status >= 400) {
      console.error("createUser failed", created.status, created.text.slice(0, 200));
      process.exit(1);
    }
    user = created.json?.user ?? created.json;
    console.log("created auth user", user?.id);
  } else {
    const reset = await resetPassword(url, serviceKey, user.id, password);
    if (reset.status >= 400) {
      console.error("resetPassword failed", reset.status, reset.text.slice(0, 200));
      process.exit(1);
    }
    console.log("reset password for existing user", user.id);
  }

  const userId = user?.id ?? user?.user?.id;
  if (!userId) {
    console.error("no user id");
    process.exit(1);
  }

  // Emit SQL for MCP follow-up (profile + membership) — printed for agent; also write artifact
  const sql = `-- smoke user provision follow-up
INSERT INTO public.profiles (id, email, full_name, role, company_id, location_id, active, is_active)
VALUES ('${userId}', '${EMAIL}', 'Smoke Test', 'employee', '${COMPANY_ID}', '${LOCATION_ID}', true, true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = 'employee',
  company_id = EXCLUDED.company_id,
  location_id = EXCLUDED.location_id,
  active = true,
  is_active = true,
  updated_at = now();

INSERT INTO public.company_memberships (user_id, company_id, role, active, source, status, location_id, activated_at)
VALUES ('${userId}', '${COMPANY_ID}', 'employee', true, 'manual', 'active', '${LOCATION_ID}', now())
ON CONFLICT (user_id, company_id) DO UPDATE SET
  role = 'employee',
  active = true,
  status = 'active',
  location_id = EXCLUDED.location_id,
  activated_at = COALESCE(public.company_memberships.activated_at, now()),
  updated_at = now();

INSERT INTO public.location_memberships (user_id, company_id, location_id, role, active, source)
VALUES ('${userId}', '${COMPANY_ID}', '${LOCATION_ID}', 'employee', true, 'manual')
ON CONFLICT (user_id, location_id) DO UPDATE SET
  role = 'employee',
  active = true,
  updated_at = now();
`;
  const sqlPath = path.join(process.cwd(), ".smoke-provision.sql");
  fs.writeFileSync(sqlPath, sql, "utf8");
  console.log("WROTE_SQL", sqlPath);

  mergeEnvLocal({
    PLAYWRIGHT_TEST_EMAIL: EMAIL,
    PLAYWRIGHT_TEST_PASSWORD: password,
    STAGING_BASE_URL: "https://staging.app.lunchportalen.no",
  });
  console.log("MERGED_ENV_LOCAL smoke creds (password not logged)");

  const login = await verifyLogin(url, anonKey, EMAIL, password);
  if (login.status !== 200 || !login.json?.access_token) {
    console.error("login verify failed", login.status, login.text.slice(0, 200));
    process.exit(1);
  }
  console.log("LOGIN_VERIFY OK");

  // Write one-line password file for agent-only merge (gitignored pattern .smoke-*)
  fs.writeFileSync(path.join(process.cwd(), ".smoke-provision.meta.json"), JSON.stringify({
    userId,
    companyId: COMPANY_ID,
    companyName: COMPANY_NAME,
    email: EMAIL,
    password,
    sqlPath,
  }), "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
