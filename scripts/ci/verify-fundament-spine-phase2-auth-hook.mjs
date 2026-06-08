#!/usr/bin/env node
/**
 * Fundament Fase 2 — auth hook shadow verification (read-only SQL checks).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/ci/verify-fundament-spine-phase2-auth-hook.mjs
 *
 * Run AFTER:
 *   20260708120000_fundament_identity_spine_phase2_auth_hook_shadow.sql
 *
 * Covers:
 *   (i)  custom_access_token_hook sample-event personas (no login)
 *   (iii) pg_policies shadow invariants (spine + tenant tables unchanged by hook)
 *   (v)  EXPLAIN plans for hook hot paths (index use)
 */

import { Client } from "pg";

const TENANT_TABLES = [
  "agreements",
  "companies",
  "company_locations",
  "company_memberships",
  "day_choices",
  "deliveries",
  "location_memberships",
  "menu_service_days",
  "order_items",
  "orders",
  "profiles",
  "provider_memberships",
];

/** ADR-016 inert provider-config skin — may use spine JWT helpers before tenant cutover (Fase 3). */
const PROVIDER_CONFIG_TABLES = [
  "provider_price_rules",
  "provider_settings",
  "provider_package_entitlements",
];

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

async function explainText(sql, params = []) {
  const { rows } = await client.query(sql, params);
  return rows.map((row) => Object.values(row)[0]).join("\n");
}

function sampleEvent(userId) {
  return JSON.stringify({
    user_id: userId,
    claims: {
      stale_org_id: "00000000-0000-0000-0000-000000000099",
      is_platform_admin: true,
    },
    authentication_method: "verify-script",
  });
}

function claimsOf(result) {
  const parsed = typeof result === "string" ? JSON.parse(result) : result;
  return parsed?.claims ?? {};
}

async function findPersonaUserId(kind) {
  switch (kind) {
    case "orderer_single": {
      const id = await scalar(
        `SELECT u.id::text AS c
         FROM auth.users u
         JOIN public.memberships m
           ON m.user_id = u.id
          AND m.status = 'active'::public.membership_status
          AND m.role = 'orderer'::public.app_role
         LEFT JOIN public.platform_admins pa ON pa.user_id = u.id
         WHERE pa.user_id IS NULL
         GROUP BY u.id
         HAVING COUNT(*) = 1
         LIMIT 1`,
      );
      if (!id) throw new Error("no orderer_single persona found");
      return id;
    }
    case "kitchen_provider": {
      const id = await scalar(
        `SELECT u.id::text AS c
         FROM auth.users u
         JOIN public.memberships m
           ON m.user_id = u.id
          AND m.status = 'active'::public.membership_status
          AND m.role = 'kitchen'::public.app_role
         JOIN public.organizations o
           ON o.id = m.org_id
          AND o.type = 'provider'::public.org_type
         LIMIT 1`,
      );
      if (!id) throw new Error("no kitchen_provider persona found");
      return id;
    }
    case "platform_admin": {
      const id = await scalar(
        `SELECT pa.user_id::text AS c
         FROM public.platform_admins pa
         ORDER BY pa.created_at
         LIMIT 1`,
      );
      if (!id) throw new Error("no platform_admin persona found");
      return id;
    }
    case "zero_membership": {
      const id = await scalar(
        `SELECT u.id::text AS c
         FROM auth.users u
         LEFT JOIN public.memberships m
           ON m.user_id = u.id
          AND m.status = 'active'::public.membership_status
         LEFT JOIN public.platform_admins pa ON pa.user_id = u.id
         WHERE m.id IS NULL
           AND pa.user_id IS NULL
         LIMIT 1`,
      );
      if (!id) throw new Error("no zero_membership persona found");
      return id;
    }
    default:
      throw new Error(`unknown persona ${kind}`);
  }
}

async function runPersonaChecks() {
  console.log("\n-- (i) custom_access_token_hook sample-event personas --");

  const personas = [
    {
      key: "orderer_single",
      assert: (claims) => {
        if (claims.is_platform_admin !== false) return "is_platform_admin must be false";
        if (!claims.active_org_id) return "missing active_org_id";
        if (claims.active_role !== "orderer") return `active_role=${claims.active_role}`;
        if (!Array.isArray(claims.memberships) || claims.memberships.length !== 1) {
          return "memberships length must be 1";
        }
        return null;
      },
    },
    {
      key: "kitchen_provider",
      assert: (claims) => {
        if (claims.is_platform_admin !== false) return "is_platform_admin must be false";
        if (!claims.active_org_id) return "missing active_org_id";
        if (claims.active_role !== "kitchen") return `active_role=${claims.active_role}`;
        if (!Array.isArray(claims.memberships) || claims.memberships.length < 1) {
          return "memberships must be non-empty";
        }
        return null;
      },
    },
    {
      key: "platform_admin",
      assert: (claims, ctx) => {
        if (claims.is_platform_admin !== true) return "is_platform_admin must be true";
        if (ctx.activeMembershipCount === 0) {
          if (claims.active_org_id) {
            return "platform_admin with 0 active memberships must omit active_org_id";
          }
          if (claims.active_role) {
            return "platform_admin with 0 active memberships must omit active_role";
          }
        } else if (!claims.active_org_id || !claims.active_role) {
          return "platform_admin with active memberships must include active_org_id and active_role";
        }
        return null;
      },
    },
    {
      key: "zero_membership",
      assert: (claims) => {
        if (claims.is_platform_admin !== false) return "is_platform_admin must be false";
        if (claims.active_org_id) return "must omit active_org_id";
        if (claims.active_role) return "must omit active_role";
        if (claims.active_location_id) return "must omit active_location_id";
        if (!Array.isArray(claims.memberships) || claims.memberships.length !== 0) {
          return "memberships must be empty array";
        }
        return null;
      },
    },
  ];

  for (const persona of personas) {
    const userId = await findPersonaUserId(persona.key);
    const activeMembershipCount = Number(
      await scalar(
        `SELECT COUNT(*)::int AS c
         FROM public.memberships
         WHERE user_id = $1::uuid
           AND status = 'active'::public.membership_status`,
        [userId],
      ),
    );
    const { rows } = await client.query(
      `SELECT public.custom_access_token_hook($1::jsonb) AS result`,
      [sampleEvent(userId)],
    );
    const claims = claimsOf(rows[0]?.result);
    const err = persona.assert(claims, { activeMembershipCount });
    if (err) {
      fail(`${persona.key} (${userId}): ${err}`);
      console.error(JSON.stringify(claims, null, 2));
    } else {
      ok(`${persona.key} (${userId}) claims valid`);
      console.log(JSON.stringify({ persona: persona.key, user_id: userId, claims }, null, 2));
    }
  }

  const failSafeUser = await findPersonaUserId("orderer_single");
  const { rows: failRows } = await client.query(
    `SELECT public.custom_access_token_hook($1::jsonb) AS result`,
    [JSON.stringify({ user_id: "not-a-uuid", claims: {} })],
  );
  const failClaims = claimsOf(failRows[0]?.result);
  if (failClaims?.active_org_id) {
    fail("fail-safe invalid user_id must return event unchanged (no org claims)");
  } else {
    ok("fail-safe invalid user_id returns unchanged event");
  }

  void failSafeUser;
}

async function runPolicyShadowChecks() {
  console.log("\n-- (iii) pg_policies shadow invariants --");

  const spinePolicies = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename IN ('organizations', 'memberships', 'platform_admins')`,
    ),
  );
  if (spinePolicies !== 0) {
    fail(`spine pg_policies = ${spinePolicies} (expected 0)`);
  } else {
    ok("spine pg_policies = 0");
  }

  const hookPolicyRefs = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename <> ALL($1::text[])
         AND (
           COALESCE(qual::text, '') ILIKE '%app_active_%'
           OR COALESCE(with_check::text, '') ILIKE '%app_active_%'
           OR COALESCE(qual::text, '') ILIKE '%active_org_id%'
           OR COALESCE(with_check::text, '') ILIKE '%active_org_id%'
         )`,
      [PROVIDER_CONFIG_TABLES],
    ),
  );
  if (hookPolicyRefs !== 0) {
    fail(
      `policies outside provider-config referencing hook claim helpers/claims = ${hookPolicyRefs} (expected 0)`,
    );
  } else {
    ok("no tenant RLS policies reference Fase 2 claim helpers yet (provider-config exempt per ADR-016)");
  }

  const tenantPolicyCount = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])`,
      [TENANT_TABLES],
    ),
  );

  const baselineRaw = String(process.env.TENANT_POLICY_COUNT_BASELINE ?? "").trim();
  if (!baselineRaw) {
    fail("TENANT_POLICY_COUNT_BASELINE must be set (locked at 53 until FASE 3 RLS policy bump)");
  }
  const baseline = Number(baselineRaw);
  if (!Number.isFinite(baseline)) {
    fail(`TENANT_POLICY_COUNT_BASELINE invalid: ${baselineRaw}`);
  }
  if (tenantPolicyCount !== baseline) {
    fail(`tenant pg_policies ${tenantPolicyCount} != baseline ${baseline}`);
  }
  ok(`tenant pg_policies unchanged = ${tenantPolicyCount}`);
}

async function runExplainChecks() {
  console.log("\n-- (v) EXPLAIN hook hot paths --");

  const sampleUser = await findPersonaUserId("orderer_single");

  await client.query("BEGIN");
  let membershipPlan = "";
  try {
    await client.query("SET LOCAL enable_seqscan = off");
    const { rows: membershipExplain } = await client.query(
      `EXPLAIN (FORMAT TEXT)
       SELECT 1
       FROM public.memberships m
       WHERE m.user_id = $1::uuid
         AND m.status = 'active'::public.membership_status`,
      [sampleUser],
    );
    membershipPlan = membershipExplain.map((r) => r["QUERY PLAN"]).join("\n");
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
  console.log(membershipPlan);
  if (!/memberships_user_id_status_idx|Index Scan|Bitmap Index Scan/i.test(membershipPlan)) {
    fail("memberships active lookup plan does not use memberships_user_id_status_idx");
  } else {
    ok("memberships (user_id, status) uses index plan");
  }

  const { rows: platformExplain } = await client.query(
    `EXPLAIN (FORMAT TEXT)
     SELECT 1
     FROM public.platform_admins pa
     WHERE pa.user_id = $1::uuid`,
    [sampleUser],
  );
  const platformPlan = platformExplain.map((r) => r["QUERY PLAN"]).join("\n");
  console.log(platformPlan);
  if (!/Index Scan|platform_admins_pkey/i.test(platformPlan)) {
    fail("platform_admins lookup plan does not use primary key index");
  } else {
    ok("platform_admins user_id uses PK index plan");
  }
}

try {
  await client.connect();

  const hookCount = Number(
    await scalar(
      `SELECT COUNT(*)::int AS c FROM pg_proc WHERE proname = 'custom_access_token_hook'`,
    ),
  );
  if (hookCount !== 1) {
    fail("custom_access_token_hook missing — apply Fase 2 migration first");
  } else {
    ok("custom_access_token_hook exists");
  }

  await runPersonaChecks();
  await runPolicyShadowChecks();
  await runExplainChecks();

  if (process.exitCode) {
    console.error("\nVERIFY FAILED — Fase 2 auth hook shadow");
  } else {
    console.log("\nVERIFY PASS — Fase 2 auth hook shadow");
  }
} catch (err) {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

process.exit(process.exitCode ?? 0);
