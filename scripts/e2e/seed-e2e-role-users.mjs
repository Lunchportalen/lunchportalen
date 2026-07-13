#!/usr/bin/env node
/**
 * STAGING-ONLY: create/repair E2E role users so the authenticated Playwright
 * matrix can run without skips (employee / company_admin / superadmin).
 *
 * - Refuses to run against prod (ref guard).
 * - Follows shouldSkipAuthPasswordSync: never rotates a password that already works.
 * - company_admin is attached to the documented staging fixture company (A6).
 * - If E2E_ADMIN_* is unset, generates credentials and APPENDS them to .env.local.
 * - Never prints passwords.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { shouldSkipAuthPasswordSync, tryVerifyLogin } from "./seed-e2e-auth-sync.mjs";

const STAGING_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";
const A6_COMPANY_ID = "8b0b8fa4-8d89-4795-b92b-e09129dd635f";
const A6_LOCATION_ID = "f319b299-8914-4c52-9984-569ce07c914d";

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

async function findUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  return (data?.users ?? []).find((u) => String(u.email ?? "").toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureAuthUser(admin, url, anonKey, email, password) {
  let user = await findUserByEmail(admin, email);
  const loginVerified = user ? await tryVerifyLogin(url, anonKey, email, password) : false;

  if (user && shouldSkipAuthPasswordSync({ userExists: true, loginVerified, emailConfirmed: Boolean(user.email_confirmed_at) })) {
    return { user, action: "verified" };
  }

  if (!user) {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw new Error(`createUser(${redact(email)}): ${created.error.message}`);
    return { user: created.data.user, action: "created" };
  }

  const updated = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    ban_duration: "none",
  });
  if (updated.error) throw new Error(`updateUser(${redact(email)}): ${updated.error.message}`);
  return { user: updated.data.user ?? user, action: "password_synced" };
}

async function ensureTenantFixture(admin, userId, email, role, fullName) {
  const now = new Date().toISOString();

  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role,
      company_id: A6_COMPANY_ID,
      location_id: A6_LOCATION_ID,
      active: true,
      is_active: true,
      updated_at: now,
    },
    { onConflict: "id" },
  );
  if (pErr) throw new Error(`profiles(${role}): ${pErr.message}`);

  const { error: cmErr } = await admin.from("company_memberships").upsert(
    {
      user_id: userId,
      company_id: A6_COMPANY_ID,
      role,
      active: true,
      source: "manual",
      status: "active",
      location_id: A6_LOCATION_ID,
      activated_at: now,
      updated_at: now,
    },
    { onConflict: "user_id,company_id" },
  );
  if (cmErr) throw new Error(`company_memberships(${role}): ${cmErr.message}`);

  // location_memberships has a narrower role check (employee/location_admin).
  const locationRole = role === "company_admin" ? "location_admin" : role;
  const { error: lmErr } = await admin.from("location_memberships").upsert(
    {
      user_id: userId,
      company_id: A6_COMPANY_ID,
      location_id: A6_LOCATION_ID,
      role: locationRole,
      active: true,
      source: "manual",
      updated_at: now,
    },
    { onConflict: "user_id,location_id" },
  );
  if (lmErr) throw new Error(`location_memberships(${locationRole}): ${lmErr.message}`);
}

async function main() {
  const envFile = path.join(process.cwd(), ".env.local");
  const env = { ...loadEnvFile(envFile), ...process.env };

  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url.includes(STAGING_REF) || url.includes(PROD_REF)) {
    console.error("ABORT: staging-only Supabase URL required (never prod)");
    process.exit(2);
  }
  if (!serviceKey || !anonKey) {
    console.error("ABORT: SUPABASE_SERVICE_ROLE_KEY + anon key required");
    process.exit(2);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const results = [];

  // 1) Superadmin: repair only (must already exist in env).
  const saEmail = String(env.E2E_SUPERADMIN_EMAIL ?? "").trim();
  const saPassword = String(env.E2E_SUPERADMIN_PASSWORD ?? "");
  if (saEmail && saPassword) {
    const { user, action } = await ensureAuthUser(admin, url, anonKey, saEmail, saPassword);
    // Superadmin truth is profiles.role — keep company scope untouched.
    const { error } = await admin
      .from("profiles")
      .upsert(
        { id: user.id, email: saEmail, role: "superadmin", active: true, is_active: true, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (error) throw new Error(`profiles(superadmin): ${error.message}`);
    const ok = await tryVerifyLogin(url, anonKey, saEmail, saPassword);
    results.push({ role: "superadmin", email: redact(saEmail), action, login: ok ? "PASS" : "FAIL" });
  } else {
    results.push({ role: "superadmin", email: "(unset)", action: "skipped", login: "MISSING_ENV" });
  }

  // 2) Employee: verify/repair with existing env credentials.
  const empEmail = String(env.E2E_EMPLOYEE_EMAIL ?? "").trim();
  const empPassword = String(env.E2E_EMPLOYEE_PASSWORD ?? "");
  if (empEmail && empPassword) {
    const { user, action } = await ensureAuthUser(admin, url, anonKey, empEmail, empPassword);
    await ensureTenantFixture(admin, user.id, empEmail, "employee", "E2E Employee");
    const ok = await tryVerifyLogin(url, anonKey, empEmail, empPassword);
    results.push({ role: "employee", email: redact(empEmail), action, login: ok ? "PASS" : "FAIL" });
  } else {
    results.push({ role: "employee", email: "(unset)", action: "skipped", login: "MISSING_ENV" });
  }

  // 3) Company admin: create if env unset (generate credentials + append to .env.local).
  let adminEmail = String(env.E2E_ADMIN_EMAIL ?? "").trim();
  let adminPassword = String(env.E2E_ADMIN_PASSWORD ?? "");
  let generated = false;
  if (!adminEmail || !adminPassword) {
    adminEmail = "e2e-company-admin-a6@lunchportalen.no";
    adminPassword = `E2e-${randomBytes(18).toString("base64url")}`;
    generated = true;
  }
  const { user: adminUser, action: adminAction } = await ensureAuthUser(admin, url, anonKey, adminEmail, adminPassword);
  await ensureTenantFixture(admin, adminUser.id, adminEmail, "company_admin", "E2E Company Admin");
  const adminOk = await tryVerifyLogin(url, anonKey, adminEmail, adminPassword);
  results.push({ role: "company_admin", email: redact(adminEmail), action: adminAction, login: adminOk ? "PASS" : "FAIL" });

  if (generated && adminOk) {
    fs.appendFileSync(
      envFile,
      `\n# E2E company_admin (staging A6) — generated by scripts/e2e/seed-e2e-role-users.mjs\nE2E_ADMIN_EMAIL=${adminEmail}\nE2E_ADMIN_PASSWORD=${adminPassword}\n`,
      "utf8",
    );
    results.push({ role: "company_admin", email: redact(adminEmail), action: "env_appended", login: "PASS" });
  }

  console.log(JSON.stringify({ stagingRef: STAGING_REF, results }, null, 2));
  const failed = results.some((r) => r.login === "FAIL" || r.login === "MISSING_ENV");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
