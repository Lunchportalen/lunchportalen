#!/usr/bin/env node
/**
 * Fundament Fase 1 — post-deploy verification (read-only checks).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/ci/verify-fundament-spine-phase1.mjs
 *
 * Run AFTER migration 20260703120000_fundament_identity_spine_phase1.sql is applied
 * (staging/prod via supabase-migrate.yml). CI green alone is NOT sufficient.
 *
 * Expected prod baseline (hkpokyapzarefrgqzkos, 2026-06-07 discovery):
 *   organizations = 11 (10 companies + 1 provider)
 *   platform_admins = 2 (profiles.role=superadmin; platform_user_roles empty)
 *   memberships = 43 (36 cm + 5 lm-insert + 2 profile provider roles)
 *   legacy row reconciliation diff = 0
 */

import { Client } from "node:pg";

const EXPECT = {
  organizations: 11,
  companies: 10,
  providers: 1,
  platformAdmins: 2,
  superadminProfiles: 2,
  memberships: 43,
  companyMemberships: 36,
  locationMemberships: 34,
  providerMemberships: 0,
};

function mustEnv(name) {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const url = mustEnv("DATABASE_URL");
const client = new Client({ connectionString: url });

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

async function scalar(sql, params = []) {
  const { rows } = await client.query(sql, params);
  return rows[0]?.c ?? rows[0]?.count ?? Object.values(rows[0] ?? {})[0];
}

try {
  await client.connect();

  // --- Spine presence ---
  for (const t of ["organizations", "memberships", "platform_admins"]) {
    const reg = await scalar(`SELECT to_regclass($1)::text AS c`, [`public.${t}`]);
    if (!reg) {
      fail(`table public.${t} missing — migration not applied?`);
    } else {
      ok(`table public.${t} exists`);
    }
  }

  const fn = await scalar(
    `SELECT COUNT(*)::int AS c FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'assert_role_valid_for_org'`,
  );
  if (Number(fn) !== 1) {
    fail("function public.assert_role_valid_for_org() missing");
  } else {
    ok("assert_role_valid_for_org present");
  }

  // --- Count: organizations ---
  const orgCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.organizations`));
  const companyCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.companies`));
  const providerCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.providers`));

  if (companyCount !== EXPECT.companies) {
    fail(`companies count ${companyCount} != expected baseline ${EXPECT.companies}`);
  }
  if (providerCount !== EXPECT.providers) {
    fail(`providers count ${providerCount} != expected baseline ${EXPECT.providers}`);
  }
  if (orgCount !== companyCount + providerCount) {
    fail(`organizations ${orgCount} != companies(${companyCount}) + providers(${providerCount})`);
  }
  if (orgCount !== EXPECT.organizations) {
    fail(`organizations ${orgCount} != expected ${EXPECT.organizations}`);
  }
  ok(`organizations count = ${orgCount} (= companies + providers)`);

  const orgByType = await client.query(
    `SELECT type::text, COUNT(*)::int AS c FROM public.organizations GROUP BY type ORDER BY type`,
  );
  for (const row of orgByType.rows) {
    console.log(`  organizations.type=${row.type} count=${row.c}`);
  }

  // --- Count: platform_admins ---
  const paCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.platform_admins`));
  const superCount = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.profiles WHERE role = 'superadmin'::public.user_role`,
    ),
  );
  if (superCount !== EXPECT.superadminProfiles) {
    fail(`profiles superadmin ${superCount} != baseline ${EXPECT.superadminProfiles}`);
  }
  if (paCount !== superCount) {
    fail(`platform_admins ${paCount} != profiles superadmin ${superCount}`);
  }
  if (paCount !== EXPECT.platformAdmins) {
    fail(`platform_admins ${paCount} != expected ${EXPECT.platformAdmins}`);
  }
  ok(`platform_admins count = ${paCount} (= profiles superadmin)`);

  // --- Count: memberships ---
  const mCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.memberships`));
  if (mCount !== EXPECT.memberships) {
    fail(`memberships ${mCount} != expected ${EXPECT.memberships}`);
  }
  ok(`memberships count = ${mCount}`);

  // --- Legacy company_memberships 1:1 ---
  const cmTotal = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.company_memberships`));
  const cmMapped = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.company_memberships cm
       JOIN public.memberships m ON m.legacy_company_membership_id = cm.id`,
    ),
  );
  const cmOrphan = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.company_memberships cm
       LEFT JOIN public.memberships m ON m.legacy_company_membership_id = cm.id
       WHERE m.id IS NULL`,
    ),
  );
  if (cmTotal !== EXPECT.companyMemberships) {
    fail(`company_memberships ${cmTotal} != baseline ${EXPECT.companyMemberships}`);
  }
  if (cmOrphan !== 0) {
    fail(`company_memberships orphan diff = ${cmOrphan} (expected 0)`);
  }
  if (cmMapped !== cmTotal) {
    fail(`company_memberships mapped ${cmMapped}/${cmTotal}`);
  }
  ok(`company_memberships reconciliation diff = 0 (${cmMapped}/${cmTotal})`);

  // --- Legacy location_memberships 1:1 ---
  const lmTotal = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.location_memberships`));
  const lmMapped = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.location_memberships lm
       JOIN public.memberships m ON m.legacy_location_membership_id = lm.id`,
    ),
  );
  const lmOrphan = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.location_memberships lm
       LEFT JOIN public.memberships m ON m.legacy_location_membership_id = lm.id
       WHERE m.id IS NULL`,
    ),
  );
  if (lmTotal !== EXPECT.locationMemberships) {
    fail(`location_memberships ${lmTotal} != baseline ${EXPECT.locationMemberships}`);
  }
  if (lmOrphan !== 0) {
    fail(`location_memberships orphan diff = ${lmOrphan} (expected 0)`);
  }
  if (lmMapped !== lmTotal) {
    fail(`location_memberships mapped ${lmMapped}/${lmTotal}`);
  }
  ok(`location_memberships reconciliation diff = 0 (${lmMapped}/${lmTotal})`);

  // --- Legacy provider_memberships 1:1 ---
  const pmTotal = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.provider_memberships`));
  const pmMapped = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.provider_memberships pm
       JOIN public.memberships m ON m.legacy_provider_membership_id = pm.id`,
    ),
  );
  const pmOrphan = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.provider_memberships pm
       LEFT JOIN public.memberships m ON m.legacy_provider_membership_id = pm.id
       WHERE m.id IS NULL`,
    ),
  );
  if (pmTotal !== EXPECT.providerMemberships) {
    fail(`provider_memberships ${pmTotal} != baseline ${EXPECT.providerMemberships}`);
  }
  if (pmOrphan !== 0) {
    fail(`provider_memberships orphan diff = ${pmOrphan} (expected 0)`);
  }
  ok(`provider_memberships reconciliation diff = 0 (${pmMapped}/${pmTotal})`);

  // --- Merge stats (informational) ---
  const mergedLm = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.memberships
       WHERE legacy_company_membership_id IS NOT NULL
         AND legacy_location_membership_id IS NOT NULL`,
    ),
  );
  const lmOnly = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.memberships
       WHERE legacy_company_membership_id IS NULL
         AND legacy_location_membership_id IS NOT NULL`,
    ),
  );
  console.log(`INFO: memberships merged cm+lm rows = ${mergedLm} (expected 29 prod)`);
  console.log(`INFO: memberships lm-only rows = ${lmOnly} (expected 5 prod)`);

  // --- Role validity (trigger would have fired on backfill) ---
  const invalidRole = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c
       FROM public.memberships m
       JOIN public.organizations o ON o.id = m.org_id
       WHERE (o.type = 'customer' AND m.role NOT IN ('company_admin', 'orderer'))
          OR (o.type = 'provider' AND m.role NOT IN ('provider_admin', 'kitchen', 'driver'))`,
    ),
  );
  if (invalidRole !== 0) {
    fail(`role/org-type violations = ${invalidRole} (expected 0)`);
  }
  ok("role/org-type violations = 0");

  const invalidStatus = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.memberships
       WHERE status NOT IN ('invited', 'active', 'suspended')`,
    ),
  );
  if (invalidStatus !== 0) {
    fail(`membership status subset violations = ${invalidStatus}`);
  }
  ok("membership status subset violations = 0");

  // --- Idempotency hint (operator re-run) ---
  console.log("");
  console.log("IDEMPOTENCY: re-apply migration 20260703120000, then re-run this script.");
  console.log("Expected: all counts unchanged, reconciliation diff remains 0.");

  if (process.exitCode) {
    console.error("\nVERIFY FAILED");
  } else {
    console.log("\nVERIFY PASS — fundament spine Fase 1");
  }
} catch (err) {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

process.exit(process.exitCode ?? 0);
