#!/usr/bin/env node
/**
 * Fundament Fase 1 — post-deploy verification (read-only checks).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/ci/verify-fundament-spine-phase1.mjs
 *
 * Run AFTER:
 *   20260703120000_fundament_identity_spine_phase1.sql
 *   20260707120000_fundament_identity_spine_phase1_review_adjustments.sql
 *   20260712120000_fundament_identity_spine_phase1_review_reconcile.sql
 *   20260708120000_fundament_identity_spine_phase2_auth_hook_shadow.sql
 *
 * CI green alone is NOT sufficient — verify via live katalog post-deploy.
 *
 * Expected prod baseline (hkpokyapzarefrgqzkos, review-corrected):
 *   organizations = 11
 *   platform_admins = 1 (prod operator only; test-domain excluded)
 *   memberships = 41 (43 − 2 ops customer-side deletions)
 *   M-CM spine rows = 34 (36 non-revoked CM − 2 ops exclusions)
 *   location_memberships eligible for M-LM = 32 (2 kitchen@/driver@ excluded)
 *   M-LM-MERGE = 27 | M-LM-INSERT = 5 | M-LM-EXCL = 2
 */

import { Client } from "node:pg";

const EXPECT = {
  organizations: 11,
  companies: 10,
  providers: 1,
  platformAdmins: 1,
  superadminProfiles: 2,
  memberships: 41,
  companyMemberships: 36,
  companyMembershipsNonRevoked: 36,
  companyMembershipsSpineMapped: 34,
  companyMembershipsOpsExcluded: 2,
  locationMemberships: 34,
  locationMembershipsEligible: 32,
  locationMembershipsOpsExcluded: 2,
  lmMerge: 27,
  lmInsertOnly: 5,
  providerMemberships: 0,
  transitoryOrgs: 2,
  transitoryMPr: 2,
  opsCustomerSpineRows: 0,
  opsProviderMPrRows: 2,
  revokedBackfilled: 0,
  revokedOnSpine: 0,
  spineRlsPolicies: 0,
  authHookFunctions: 1,
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

const OPS_EMAILS_SQL = `lower(u.email) IN ('kitchen@lunchportalen.no', 'driver@lunchportalen.no')`;

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

  const oldProviderCol = await scalar(
    `SELECT COUNT(*)::int AS c FROM information_schema.columns
     WHERE table_schema='public' AND table_name='organizations' AND column_name='customer_provider_org_id'`,
  );
  if (Number(oldProviderCol) !== 0) {
    fail("organizations.customer_provider_org_id still present (R3 incomplete)");
  } else {
    ok("organizations.customer_provider_org_id absent (R3)");
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

  const sourceRuleCol = await scalar(
    `SELECT COUNT(*)::int AS c FROM information_schema.columns
     WHERE table_schema='public' AND table_name='memberships' AND column_name='source_rule'`,
  );
  if (Number(sourceRuleCol) !== 1) {
    fail("memberships.source_rule column missing (R4b)");
  } else {
    ok("memberships.source_rule present (R4b)");
  }

  const uniqueDef = await scalar(
    `SELECT pg_get_constraintdef(c.oid) AS c
     FROM pg_constraint c
     WHERE c.conrelid = 'public.memberships'::regclass
       AND c.conname = 'memberships_user_org_role_location_uniq'`,
  );
  if (!uniqueDef || !String(uniqueDef).includes("location_id")) {
    fail("memberships_user_org_role_location_uniq missing or wrong definition");
  } else {
    ok("unique (user_id, org_id, role, location_id) constraint present");
  }

  const oldUnique = await scalar(
    `SELECT COUNT(*)::int AS c FROM pg_constraint
     WHERE conrelid = 'public.memberships'::regclass
       AND conname = 'memberships_user_org_role_uniq'`,
  );
  if (Number(oldUnique) !== 0) {
    fail("legacy memberships_user_org_role_uniq still present");
  } else {
    ok("legacy memberships_user_org_role_uniq dropped");
  }

  const mapFnDef = String(
    await scalar(`SELECT pg_get_functiondef('public.lp_fundament_map_membership_status'::regproc) AS c`),
  );
  if (/revoked.*suspended|suspended.*revoked/i.test(mapFnDef)) {
    fail("lp_fundament_map_membership_status still maps revoked→suspended (R2)");
  } else {
    ok("lp_fundament_map_membership_status excludes revoked→suspended (R2)");
  }

  const opsHelper = await scalar(
    `SELECT COUNT(*)::int AS c FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'lp_fundament_is_ops_lm_excluded'`,
  );
  if (Number(opsHelper) !== 1) {
    fail("lp_fundament_is_ops_lm_excluded missing");
  } else {
    ok("lp_fundament_is_ops_lm_excluded present");
  }

  // --- organizations ---
  const orgCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.organizations`));
  const companyCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.companies`));
  const providerCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.providers`));

  if (companyCount !== EXPECT.companies) {
    fail(`companies count ${companyCount} != baseline ${EXPECT.companies}`);
  }
  if (providerCount !== EXPECT.providers) {
    fail(`providers count ${providerCount} != baseline ${EXPECT.providers}`);
  }
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
  const testPaCount = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c
       FROM public.platform_admins pa
       JOIN auth.users u ON u.id = pa.user_id
       WHERE lower(u.email) LIKE '%@test.lunchportalen.no'`,
    ),
  );
  const prodPaCount = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c
       FROM public.platform_admins pa
       JOIN auth.users u ON u.id = pa.user_id
       WHERE lower(u.email) = 'superadmin@lunchportalen.no'`,
    ),
  );

  if (superCount !== EXPECT.superadminProfiles) {
    fail(`profiles superadmin ${superCount} != baseline ${EXPECT.superadminProfiles}`);
  }
  if (paCount !== EXPECT.platformAdmins) {
    fail(`platform_admins ${paCount} != expected ${EXPECT.platformAdmins}`);
  }
  if (testPaCount !== 0) {
    fail(`test-domain platform_admins ${testPaCount} != 0`);
  }
  if (prodPaCount !== 1) {
    fail(`prod operator platform_admins ${prodPaCount} != 1`);
  }
  ok(`platform_admins count = ${paCount} (prod operator only; profiles superadmin = ${superCount})`);

  // --- memberships count ---
  const mCount = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.memberships`));
  if (mCount !== EXPECT.memberships) {
    fail(`memberships ${mCount} != expected ${EXPECT.memberships}`);
  }
  ok(`memberships count = ${mCount}`);

  const revokedOnSpine = Number(
    await scalar(`SELECT COUNT(*)::int AS c FROM public.memberships WHERE status = 'revoked'::public.membership_status`),
  );
  if (revokedOnSpine !== EXPECT.revokedOnSpine) {
    fail(`memberships with status=revoked = ${revokedOnSpine}`);
  }
  ok(`memberships status=revoked count = ${revokedOnSpine}`);

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

  // --- M-CM: 34 mapped, 2 intentional ops exclusions ---
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
  const cmOpsOrphan = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.company_memberships cm
       LEFT JOIN public.memberships m ON m.legacy_company_membership_id = cm.id
       JOIN auth.users u ON u.id = cm.user_id
       WHERE cm.status IS DISTINCT FROM 'revoked'::public.membership_status
         AND m.id IS NULL
         AND ${OPS_EMAILS_SQL}`,
    ),
  );

  if (cmNonRevoked !== EXPECT.companyMembershipsNonRevoked) {
    fail(`non-revoked company_memberships ${cmNonRevoked} != ${EXPECT.companyMembershipsNonRevoked}`);
  }
  if (cmMapped !== EXPECT.companyMembershipsSpineMapped) {
    fail(`M-CM spine mapped ${cmMapped} != expected ${EXPECT.companyMembershipsSpineMapped}`);
  }
  if (cmOrphan !== EXPECT.companyMembershipsOpsExcluded) {
    fail(`M-CM orphan ${cmOrphan} != expected ops exclusions ${EXPECT.companyMembershipsOpsExcluded}`);
  }
  if (cmOpsOrphan !== EXPECT.companyMembershipsOpsExcluded) {
    fail(`M-CM ops orphan ${cmOpsOrphan} != ${EXPECT.companyMembershipsOpsExcluded}`);
  }
  ok(`M-CM spine mapped = ${cmMapped}/${cmNonRevoked}; ops exclusions = ${cmOrphan}`);

  if (Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.company_memberships`)) !== EXPECT.companyMemberships) {
    fail("company_memberships legacy count changed");
  } else {
    ok(`company_memberships legacy count unchanged = ${EXPECT.companyMemberships}`);
  }

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
  ok(`kitchen@/driver@ LM excluded from spine legacy_location_membership_id = 0`);

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

  const opsCustomerSpine = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c
       FROM public.memberships m
       JOIN public.organizations o ON o.id = m.org_id
       JOIN auth.users u ON u.id = m.user_id
       WHERE o.type = 'customer'::public.org_type
         AND ${OPS_EMAILS_SQL}`,
    ),
  );
  if (opsCustomerSpine !== EXPECT.opsCustomerSpineRows) {
    fail(`ops customer-side spine rows = ${opsCustomerSpine} (expected 0)`);
  }
  ok(`ops customer-side spine rows = 0`);

  const opsProviderMPr = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c
       FROM public.memberships m
       JOIN public.organizations o ON o.id = m.org_id
       JOIN auth.users u ON u.id = m.user_id
       WHERE o.type = 'provider'::public.org_type
         AND m.role IN ('kitchen'::public.app_role, 'driver'::public.app_role)
         AND m.source_rule = 'M-PR'
         AND m.metadata->>'transitory' = 'true'
         AND ${OPS_EMAILS_SQL}`,
    ),
  );
  if (opsProviderMPr !== EXPECT.opsProviderMPrRows) {
    fail(`ops provider M-PR rows = ${opsProviderMPr} (expected ${EXPECT.opsProviderMPrRows})`);
  }
  ok(`ops provider M-PR rows (kitchen/driver) = ${opsProviderMPr}`);

  const mprTransitory = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.memberships
       WHERE source_rule = 'M-PR'
         AND metadata->>'transitory' = 'true'
         AND metadata->>'phase4_pension' = 'derived_profile_provider_binding'`,
    ),
  );
  if (mprTransitory !== EXPECT.transitoryMPr) {
    fail(`M-PR transitory markers ${mprTransitory} != expected ${EXPECT.transitoryMPr}`);
  }
  ok(`M-PR transitory markers = ${mprTransitory}`);

  const pmTotal = Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.provider_memberships`));
  const pmMapped = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM public.provider_memberships pm
       JOIN public.memberships m ON m.legacy_provider_membership_id = pm.id`,
    ),
  );
  if (pmTotal !== EXPECT.providerMemberships || pmMapped !== 0) {
    fail(`provider_memberships reconciliation ${pmMapped}/${pmTotal}`);
  }
  ok(`provider_memberships reconciliation diff = 0 (${pmMapped}/${pmTotal})`);

  if (Number(await scalar(`SELECT COUNT(*)::int AS c FROM public.location_memberships`)) !== EXPECT.locationMemberships) {
    fail("location_memberships legacy count changed");
  } else {
    ok(`location_memberships legacy count unchanged = ${EXPECT.locationMemberships}`);
  }

  const spineRls = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename IN ('organizations', 'memberships', 'platform_admins')`,
    ),
  );
  if (spineRls !== EXPECT.spineRlsPolicies) {
    fail(`spine RLS policies = ${spineRls} (expected 0)`);
  }
  ok(`spine RLS policies = 0`);

  const authHooks = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM pg_proc WHERE proname ILIKE '%custom_access_token_hook%'`,
    ),
  );
  if (authHooks !== EXPECT.authHookFunctions) {
    fail(`custom_access_token_hook functions = ${authHooks} (expected ${EXPECT.authHookFunctions})`);
  }
  ok(`custom_access_token_hook present (Fase 2 shadow)`);

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
  console.log(
    "IDEMPOTENCY: re-apply 20260712120000_fundament_identity_spine_phase1_review_reconcile.sql (or 20260707120000), then re-run this script.",
  );
  console.log("Expected: all counts unchanged, all diff checks remain 0.");

  if (process.exitCode) {
    console.error("\nVERIFY FAILED");
  } else {
    console.log("\nVERIFY PASS — fundament spine Fase 1 (review-corrected)");
  }
} catch (err) {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

process.exit(process.exitCode ?? 0);
