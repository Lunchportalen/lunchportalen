#!/usr/bin/env node
/**
 * Fundament Fase 1 — post-deploy verification (read-only checks).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/ci/verify-fundament-spine-phase1.mjs
 *
 * Run AFTER migration 20260703120000_fundament_identity_spine_phase1.sql is applied.
 * CI green alone is NOT sufficient — verify via live katalog post-deploy.
 *
 * Expected prod baseline (hkpokyapzarefrgqzkos, review-adjusted 2026-06-07):
 *   organizations = 11
 *   platform_admins = 2
 *   memberships = 43 (36 M-CM + 5 M-LM-INSERT + 2 M-PR)
 *   location_memberships eligible for M-LM = 32 (2 kitchen@/driver@ excluded)
 *   M-LM-MERGE = 27 | M-LM-INSERT = 5 | M-LM-EXCL = 2
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
  companyMembershipsNonRevoked: 36,
  locationMemberships: 34,
  locationMembershipsEligible: 32,
  locationMembershipsOpsExcluded: 2,
  lmMerge: 27,
  lmInsertOnly: 5,
  providerMemberships: 0,
  transitoryOrgs: 2,
  transitoryMPr: 2,
  revokedBackfilled: 0,
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

const OPS_LM_EXCL_SQL = `
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = lm.user_id
      AND (lower(u.email) = 'kitchen@lunchportalen.no' OR lower(u.email) = 'driver@lunchportalen.no')
  )
`;

try {
  await client.connect();

  for (const t of ["organizations", "memberships", "platform_admins"]) {
    const reg = await scalar(`SELECT to_regclass($1)::text AS c`, [`public.${t}`]);
    if (!reg) fail(`table public.${t} missing — migration not applied?`);
    else ok(`table public.${t} exists`);
  }

  const legacyProviderCol = await scalar(
    `SELECT COUNT(*)::int AS c FROM information_schema.columns
     WHERE table_schema='public' AND table_name='organizations' AND column_name='legacy_provider_id'`,
  );
  if (Number(legacyProviderCol) !== 1) {
    fail("organizations.legacy_provider_id column missing (R3)");
  } else {
    ok("organizations.legacy_provider_id present (R3)");
  }

  const locationCol = await scalar(
    `SELECT COUNT(*)::int AS c FROM information_schema.columns
     WHERE table_schema='public' AND table_name='memberships' AND column_name='location_id'`,
  );
  if (Number(locationCol) !== 1) {
    fail("memberships.location_id column missing (R1)");
  } else {
    ok("memberships.location_id present (R1)");
  }

  // --- organizations ---
  const orgCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.organizations`));
  const companyCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.companies`));
  const providerCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.providers`));

  if (orgCount !== companyCount + providerCount) {
    fail(`organizations ${orgCount} != companies(${companyCount}) + providers(${providerCount})`);
  }
  if (orgCount !== EXPECT.organizations) {
    fail(`organizations ${orgCount} != expected ${EXPECT.organizations}`);
  }
  ok(`organizations count = ${orgCount}`);

  const transitoryOrgCount = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.organizations
       WHERE metadata->>'transitory' = 'true'
         AND metadata->>'phase4_pension' = 'platform_internal_customer'`,
    ),
  );
  if (transitoryOrgCount !== EXPECT.transitoryOrgs) {
    fail(`transitory org markers ${transitoryOrgCount} != expected ${EXPECT.transitoryOrgs}`);
  }
  ok(`transitory org markers (Lunchportalen AS/QA) = ${transitoryOrgCount}`);

  // --- platform_admins ---
  const paCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.platform_admins`));
  const superCount = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.profiles WHERE role = 'superadmin'::public.user_role`,
    ),
  );
  if (paCount !== superCount || paCount !== EXPECT.platformAdmins) {
    fail(`platform_admins ${paCount} != superadmin profiles ${superCount}`);
  }
  ok(`platform_admins count = ${paCount}`);

  // --- memberships count ---
  const mCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.memberships`));
  if (mCount !== EXPECT.memberships) {
    fail(`memberships ${mCount} != expected ${EXPECT.memberships}`);
  }
  ok(`memberships count = ${mCount}`);

  // --- R2: no revoked backfilled ---
  const revokedBackfilled = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c
       FROM public.company_memberships cm
       JOIN public.memberships m ON m.legacy_company_membership_id = cm.id
       WHERE cm.status = 'revoked'::public.membership_status`,
    ),
  );
  if (revokedBackfilled !== EXPECT.revokedBackfilled) {
    fail(`revoked rows backfilled = ${revokedBackfilled} (expected 0)`);
  }
  ok(`revoked membership backfill count = ${revokedBackfilled}`);

  // --- M-CM reconciliation (non-revoked only) ---
  const cmNonRevoked = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.company_memberships
       WHERE status IS DISTINCT FROM 'revoked'::public.membership_status`,
    ),
  );
  const cmMapped = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.company_memberships cm
       JOIN public.memberships m ON m.legacy_company_membership_id = cm.id
       WHERE cm.status IS DISTINCT FROM 'revoked'::public.membership_status`,
    ),
  );
  const cmOrphan = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.company_memberships cm
       LEFT JOIN public.memberships m ON m.legacy_company_membership_id = cm.id
       WHERE cm.status IS DISTINCT FROM 'revoked'::public.membership_status
         AND m.id IS NULL`,
    ),
  );
  if (cmOrphan !== 0 || cmMapped !== cmNonRevoked) {
    fail(`company_memberships reconciliation diff = ${cmOrphan} (${cmMapped}/${cmNonRevoked})`);
  }
  ok(`company_memberships reconciliation diff = 0 (${cmMapped}/${cmNonRevoked} non-revoked)`);

  // --- M-LM: eligible vs excluded ---
  const lmOpsExcluded = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.location_memberships lm WHERE ${OPS_LM_EXCL_SQL}`,
    ),
  );
  const lmEligible = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.location_memberships lm WHERE NOT (${OPS_LM_EXCL_SQL})`,
    ),
  );
  if (lmOpsExcluded !== EXPECT.locationMembershipsOpsExcluded) {
    fail(`M-LM-EXCL count ${lmOpsExcluded} != expected ${EXPECT.locationMembershipsOpsExcluded}`);
  }
  if (lmEligible !== EXPECT.locationMembershipsEligible) {
    fail(`M-LM eligible ${lmEligible} != expected ${EXPECT.locationMembershipsEligible}`);
  }
  ok(`M-LM-EXCL (kitchen@/driver@) = ${lmOpsExcluded}; eligible LM = ${lmEligible}`);

  const lmMappedEligible = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.location_memberships lm
       JOIN public.memberships m ON m.legacy_location_membership_id = lm.id
       WHERE NOT (${OPS_LM_EXCL_SQL})`,
    ),
  );
  const lmOrphanEligible = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.location_memberships lm
       LEFT JOIN public.memberships m ON m.legacy_location_membership_id = lm.id
       WHERE NOT (${OPS_LM_EXCL_SQL}) AND m.id IS NULL`,
    ),
  );
  if (lmOrphanEligible !== 0 || lmMappedEligible !== lmEligible) {
    fail(`eligible location_memberships reconciliation diff = ${lmOrphanEligible}`);
  }
  ok(`eligible location_memberships reconciliation diff = 0 (${lmMappedEligible}/${lmEligible})`);

  const opsLmOnSpine = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.location_memberships lm
       JOIN public.memberships m ON m.legacy_location_membership_id = lm.id
       WHERE ${OPS_LM_EXCL_SQL}`,
    ),
  );
  if (opsLmOnSpine !== 0) {
    fail(`kitchen@/driver@ LM rows mapped to spine = ${opsLmOnSpine} (expected 0)`);
  }
  ok(`kitchen@/driver@ LM excluded from spine = 0 legacy_location_membership_id`);

  // --- R1: location_id diff for eligible M-LM rows ---
  const locationIdMismatch = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c
       FROM public.location_memberships lm
       JOIN public.memberships m ON m.legacy_location_membership_id = lm.id
       WHERE NOT (${OPS_LM_EXCL_SQL})
         AND m.location_id IS DISTINCT FROM lm.location_id`,
    ),
  );
  if (locationIdMismatch !== 0) {
    fail(`memberships.location_id mismatch vs location_memberships = ${locationIdMismatch}`);
  }
  ok(`memberships.location_id M-LM diff = 0`);

  // --- R1: unique constraint conflict check (duplicate keys in result set) ---
  const uniqueDupes = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM (
         SELECT user_id, org_id, role, location_id, COUNT(*) AS n
         FROM public.memberships
         GROUP BY user_id, org_id, role, location_id
         HAVING COUNT(*) > 1
       ) d`,
    ),
  );
  if (uniqueDupes !== 0) {
    fail(`(user,org,role,location_id) duplicate groups = ${uniqueDupes}`);
  }
  ok(`(user,org,role,location_id) unique conflict groups = 0`);

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
  if (mergedLm !== EXPECT.lmMerge) {
    fail(`M-LM-MERGE rows ${mergedLm} != expected ${EXPECT.lmMerge}`);
  }
  if (lmOnly !== EXPECT.lmInsertOnly) {
    fail(`M-LM-INSERT-only rows ${lmOnly} != expected ${EXPECT.lmInsertOnly}`);
  }
  ok(`M-LM-MERGE = ${mergedLm}; M-LM-INSERT-only = ${lmOnly}`);

  // --- M-PR transitory markers (R4) ---
  const mprTransitory = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.memberships
       WHERE metadata->>'transitory' = 'true'
         AND metadata->>'phase4_pension' = 'derived_profile_provider_binding'
         AND metadata->>'source_rule' = 'M-PR'`,
    ),
  );
  if (mprTransitory !== EXPECT.transitoryMPr) {
    fail(`M-PR transitory markers ${mprTransitory} != expected ${EXPECT.transitoryMPr}`);
  }
  ok(`M-PR transitory markers = ${mprTransitory}`);

  // --- provider_memberships ---
  const pmTotal = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.provider_memberships`));
  const pmMapped = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.provider_memberships pm
       JOIN public.memberships m ON m.legacy_provider_membership_id = pm.id`,
    ),
  );
  if (pmTotal !== 0 || pmMapped !== 0) {
    fail(`provider_memberships reconciliation ${pmMapped}/${pmTotal}`);
  }
  ok(`provider_memberships reconciliation diff = 0 (${pmMapped}/${pmTotal})`);

  // --- role / status validity ---
  const invalidRole = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c
       FROM public.memberships m
       JOIN public.organizations o ON o.id = m.org_id
       WHERE (o.type = 'customer' AND m.role NOT IN ('company_admin', 'orderer'))
          OR (o.type = 'provider' AND m.role NOT IN ('provider_admin', 'kitchen', 'driver'))`,
    ),
  );
  if (invalidRole !== 0) fail(`role/org-type violations = ${invalidRole}`);
  else ok("role/org-type violations = 0");

  const invalidStatus = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.memberships
       WHERE status NOT IN ('invited', 'active', 'suspended')`,
    ),
  );
  if (invalidStatus !== 0) fail(`status subset violations = ${invalidStatus}`);
  else ok("membership status subset violations = 0");

  console.log("");
  console.log("IDEMPOTENCY: re-apply migration 20260703120000, then re-run this script.");
  console.log("Expected: all counts unchanged, all diff checks remain 0.");

  if (process.exitCode) {
    console.error("\nVERIFY FAILED");
  } else {
    console.log("\nVERIFY PASS — fundament spine Fase 1 (review-adjusted)");
  }
} catch (err) {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

process.exit(process.exitCode ?? 0);
