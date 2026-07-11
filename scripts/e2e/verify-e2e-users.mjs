#!/usr/bin/env node
/**
 * Verify E2E_* credentials against STAGING Supabase (read-only login probe).
 * Never prints secrets; never targets prod. Used by the global release gate
 * and the launch runbook pre-flight.
 */
import fs from "node:fs";
import path from "node:path";

import { tryVerifyLogin } from "./seed-e2e-auth-sync.mjs";

const STAGING_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function redact(email) {
  const e = String(email ?? "");
  const at = e.indexOf("@");
  if (at <= 1) return "(unset)";
  return `${e.slice(0, 2)}***${e.slice(at)}`;
}

const env = { ...loadEnvFile(path.join(process.cwd(), ".env.local")), ...process.env };
const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!url.includes(STAGING_REF) || url.includes(PROD_REF)) {
  console.error("ABORT: staging-only Supabase URL required (never prod)");
  process.exit(2);
}
if (!anonKey) {
  console.error("ABORT: NEXT_PUBLIC_SUPABASE_ANON_KEY required");
  process.exit(2);
}

const ROLES = [
  ["employee", env.E2E_EMPLOYEE_EMAIL, env.E2E_EMPLOYEE_PASSWORD],
  ["company_admin", env.E2E_ADMIN_EMAIL, env.E2E_ADMIN_PASSWORD],
  ["superadmin", env.E2E_SUPERADMIN_EMAIL, env.E2E_SUPERADMIN_PASSWORD],
  ["test_user", env.E2E_TEST_USER_EMAIL ?? env.E2E_EMPLOYEE_EMAIL, env.E2E_TEST_USER_PASSWORD ?? env.E2E_EMPLOYEE_PASSWORD],
];

let failures = 0;
for (const [role, email, password] of ROLES) {
  if (!email || !password) {
    console.log(`MISSING: ${role} (${redact(email)}) — env not set`);
    failures += 1;
    continue;
  }
  const ok = await tryVerifyLogin(url, anonKey, String(email).trim(), String(password));
  console.log(`${ok ? "OK" : "FAIL"}: ${role} login (${redact(email)})`);
  if (!ok) failures += 1;
}

process.exit(failures > 0 ? 1 : 0);
