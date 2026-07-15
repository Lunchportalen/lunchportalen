#!/usr/bin/env node
/**
 * Idempotent E2E role users on uigx (scratch) only.
 * Passwords: E2E_*_PASSWORD env (CI secrets / .env.local — never committed).
 * Emails: fixed canonical addresses (must match E2E_*_EMAIL secrets).
 *
 * Prerequisite chain: migrations → seed-staging-tenant.sql → seed-smoke-menu-fixture.mjs → this script.
 * See docs/e2e/UIGX-RESEED-CHAIN.md
 *
 * Session note: auth.admin.updateUserById (password) revokes active refresh tokens.
 * Re-seeding an unchanged password during parallel CI (e.g. week-visual + E2E) invalidates
 * in-flight browser sessions — skip sync when password grant already succeeds.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import {
  shouldSkipAuthPasswordSync,
  tryVerifyLogin,
} from "../e2e/seed-e2e-auth-sync.mjs";

const UIGX_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";

/** Deterministic addresses — Thomas must set E2E_*_EMAIL repo secrets to these exact values. */
export const E2E_CANONICAL_EMAILS = {
  test_user: "e2e.test-user@lunchportalen.no",
  employee: "e2e.employee@lunchportalen.no",
  admin: "e2e.company-admin@lunchportalen.no",
  superadmin: "e2e.superadmin@lunchportalen.no",
  kitchen: "e2e.kitchen@lunchportalen.no",
};

const A6_COMPANY_ID = "8b0b8fa4-8d89-4795-b92b-e09129dd635f";
const A6_LOCATION_ID = "f319b299-8914-4c52-9984-569ce07c914d";

/** Mirrors sync_memberships_from_legacy_profile(): company vs location roles differ. */
const ROLE_SPECS = [
  {
    key: "test_user",
    emailEnv: "E2E_TEST_USER_EMAIL",
    passwordEnv: "E2E_TEST_USER_PASSWORD",
    profileRole: "employee",
    fullName: "E2E Test User",
    companyId: A6_COMPANY_ID,
    locationId: A6_LOCATION_ID,
    companyMembershipRole: "employee",
    locationMembershipRole: "employee",
  },
  {
    key: "employee",
    emailEnv: "E2E_EMPLOYEE_EMAIL",
    passwordEnv: "E2E_EMPLOYEE_PASSWORD",
    profileRole: "employee",
    fullName: "E2E Employee",
    companyId: A6_COMPANY_ID,
    locationId: A6_LOCATION_ID,
    companyMembershipRole: "employee",
    locationMembershipRole: "employee",
  },
  {
    key: "admin",
    emailEnv: "E2E_ADMIN_EMAIL",
    passwordEnv: "E2E_ADMIN_PASSWORD",
    profileRole: "company_admin",
    fullName: "E2E Company Admin",
    companyId: A6_COMPANY_ID,
    locationId: A6_LOCATION_ID,
    companyMembershipRole: "company_admin",
    locationMembershipRole: "employee",
  },
  {
    key: "superadmin",
    emailEnv: "E2E_SUPERADMIN_EMAIL",
    passwordEnv: "E2E_SUPERADMIN_PASSWORD",
    profileRole: "superadmin",
    fullName: "E2E Superadmin",
    companyId: null,
    locationId: null,
    companyMembershipRole: null,
    locationMembershipRole: null,
  },
  {
    key: "kitchen",
    emailEnv: "E2E_KITCHEN_EMAIL",
    passwordEnv: "E2E_KITCHEN_PASSWORD",
    profileRole: "kitchen",
    fullName: "E2E Kitchen",
    companyId: A6_COMPANY_ID,
    locationId: A6_LOCATION_ID,
    companyMembershipRole: "employee",
    locationMembershipRole: "employee",
  },
];

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

function assertTargetDb(url) {
  const u = String(url ?? "").trim();
  if (!u) {
    console.error("ABORT: NEXT_PUBLIC_SUPABASE_URL is empty");
    process.exit(2);
  }
  if (u.includes(PROD_REF)) {
    console.error(`ABORT: refuse prod ref ${PROD_REF}`);
    process.exit(2);
  }
  if (!u.includes(UIGX_REF)) {
    console.error(`ABORT: NEXT_PUBLIC_SUPABASE_URL must contain uigx ref ${UIGX_REF}`);
    process.exit(2);
  }
}

async function findUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const users = data?.users ?? [];
  return (
    users.find((u) => String(u.email ?? "").toLowerCase() === email.toLowerCase()) ?? null
  );
}

async function upsertAuthUser(admin, url, anonKey, email, password) {
  let user = await findUserByEmail(admin, email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error) {
      throw new Error(`createUser ${email}: ${created.error.message}`);
    }
    user = created.data.user;
    console.log(`auth created ${email}`);
  } else {
    const emailConfirmed = Boolean(user.email_confirmed_at ?? user.confirmed_at);
    const loginVerified = await tryVerifyLogin(url, anonKey, email, password);

    if (
      shouldSkipAuthPasswordSync({
        userExists: true,
        loginVerified,
        emailConfirmed,
      })
    ) {
      console.log(
        `auth unchanged ${email} (skip updateUserById — preserves active sessions)`,
      );
    } else {
      const updated = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      });
      if (updated.error) {
        throw new Error(`updateUser ${email}: ${updated.error.message}`);
      }
      console.log(`auth password synced ${email}`);
    }
  }
  if (!user?.id) throw new Error(`no user id for ${email}`);
  return user.id;
}

async function upsertProfile(admin, userId, spec, email) {
  const row = {
    id: userId,
    email,
    full_name: spec.fullName,
    role: spec.profileRole,
    company_id: spec.companyId,
    location_id: spec.locationId,
    active: true,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("profiles").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`profiles upsert ${email}: ${error.message}`);
}

async function upsertMemberships(admin, userId, spec) {
  if (!spec.companyId || !spec.companyMembershipRole) return;

  const companyRow = {
    user_id: userId,
    company_id: spec.companyId,
    role: spec.companyMembershipRole,
    active: true,
    source: "manual",
    status: "active",
    location_id: spec.locationId,
    activated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error: cmErr } = await admin
    .from("company_memberships")
    .upsert(companyRow, { onConflict: "user_id,company_id" });
  if (cmErr) throw new Error(`company_memberships ${spec.key}: ${cmErr.message}`);

  if (spec.locationId && spec.locationMembershipRole) {
    const locRow = {
      user_id: userId,
      company_id: spec.companyId,
      location_id: spec.locationId,
      role: spec.locationMembershipRole,
      active: true,
      source: "manual",
      updated_at: new Date().toISOString(),
    };
    const { error: lmErr } = await admin
      .from("location_memberships")
      .upsert(locRow, { onConflict: "user_id,location_id" });
    if (lmErr) throw new Error(`location_memberships ${spec.key}: ${lmErr.message}`);
  }
}

async function verifyLogin(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`login verify ${email}: ${res.status} ${text.slice(0, 120)}`);
  }
}

async function main() {
  const env = { ...loadEnvFile(path.join(process.cwd(), ".env.local")), ...process.env };
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyKeys = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  assertTargetDb(url);

  if (!serviceKey || !anonKey) {
    console.error("ABORT: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY required");
    process.exit(2);
  }

  for (const spec of ROLE_SPECS) {
    const canonical = E2E_CANONICAL_EMAILS[spec.key];
    const fromEnv = String(env[spec.emailEnv] ?? "").trim().toLowerCase();
    const password = String(env[spec.passwordEnv] ?? "");
    if (!onlyKeys || onlyKeys.has(spec.key)) {
      if (!fromEnv || !password) {
        console.error(`ABORT: missing ${spec.emailEnv} or ${spec.passwordEnv}`);
        process.exit(2);
      }
      if (fromEnv !== canonical.toLowerCase()) {
        console.error(
          `ABORT: ${spec.emailEnv} must be ${canonical} (got ${fromEnv})`,
        );
        process.exit(2);
      }
    }
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const spec of ROLE_SPECS) {
    if (onlyKeys && !onlyKeys.has(spec.key)) continue;
    const email = E2E_CANONICAL_EMAILS[spec.key];
    const password = String(env[spec.passwordEnv] ?? "");
    const userId = await upsertAuthUser(admin, url, anonKey, email, password);
    await upsertProfile(admin, userId, spec, email);
    await upsertMemberships(admin, userId, spec);
    await verifyLogin(url, anonKey, email, password);
    console.log(`OK ${spec.key} ${email}`);
  }

  console.log("E2E_SEED_OK uigx", UIGX_REF);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
