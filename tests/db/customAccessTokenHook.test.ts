/**
 * A1: custom_access_token_hook claim matrix (database integration test).
 *
 * Runs against a LOCAL Supabase Postgres only (LP_LOCAL_DB_URL or the default
 * supabase start URL). Skips when no local DB is reachable, so plain
 * `npm run test` stays green without Docker.
 *
 * Matrix: null membership · one membership · multiple memberships ·
 * suspended membership · archived org · platform admin (superadmin) ·
 * provider admin · company admin · employee (orderer) · invalid preferred membership.
 */
// @ts-nocheck
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";

const LOCAL_DB_URL =
  process.env.LP_LOCAL_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const isLocal = LOCAL_DB_URL.includes("127.0.0.1") || LOCAL_DB_URL.includes("localhost");

let client: pg.Client | null = null;
let dbAvailable = false;

// Deterministic test ids (cleaned up per run)
const ids = {
  providerOrg: randomUUID(),
  customerOrg: randomUUID(),
  customerOrgB: randomUUID(),
  archivedOrg: randomUUID(),
  location: randomUUID(),
  userNone: randomUUID(),
  userOrderer: randomUUID(),
  userMulti: randomUUID(),
  userSuspended: randomUUID(),
  userArchived: randomUUID(),
  userPlatformAdmin: randomUUID(),
  userProviderAdmin: randomUUID(),
  userCompanyAdmin: randomUUID(),
  userBadPreferred: randomUUID(),
};

async function q(text: string, values: unknown[] = []) {
  if (!client) throw new Error("no client");
  return client.query(text, values);
}

async function callHook(userId: string, extraClaims: Record<string, unknown> = {}) {
  const event = { user_id: userId, claims: extraClaims, authentication_method: "vitest" };
  const { rows } = await q(`SELECT public.custom_access_token_hook($1::jsonb) AS result`, [
    JSON.stringify(event),
  ]);
  const parsed = typeof rows[0]?.result === "string" ? JSON.parse(rows[0].result) : rows[0]?.result;
  return parsed?.claims ?? {};
}

async function createUser(id: string, email: string) {
  await q(
    `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [id, email],
  );
  await q(
    `INSERT INTO public.profiles (id, email, role) VALUES ($1, $2, 'employee'::public.user_role)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [id, email],
  );
}

async function createOrg(id: string, type: "provider" | "customer", status: string, providerOrgId: string | null) {
  await q(
    `INSERT INTO public.organizations (id, type, name, status, legacy_source, legacy_provider_id, created_at, updated_at)
     VALUES ($1, $2::public.org_type, $3, $4, $5, $6, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [id, type, `hooktest-${id.slice(0, 8)}`, status, type === "provider" ? "provider" : "company", providerOrgId],
  );
}

async function addMembership(
  userId: string,
  orgId: string,
  role: string,
  status: string,
  locationId: string | null = null,
): Promise<string> {
  const { rows } = await q(
    `INSERT INTO public.memberships (user_id, org_id, role, status, location_id)
     VALUES ($1, $2, $3::public.app_role, $4::public.membership_status, $5)
     RETURNING id`,
    [userId, orgId, role, status, locationId],
  );
  return rows[0].id;
}

async function cleanup() {
  const users = [
    ids.userNone,
    ids.userOrderer,
    ids.userMulti,
    ids.userSuspended,
    ids.userArchived,
    ids.userPlatformAdmin,
    ids.userProviderAdmin,
    ids.userCompanyAdmin,
    ids.userBadPreferred,
  ];
  const orgs = [ids.providerOrg, ids.customerOrg, ids.customerOrgB, ids.archivedOrg];
  await q(`DELETE FROM public.memberships WHERE user_id = ANY($1::uuid[])`, [users]);
  await q(`DELETE FROM public.platform_admins WHERE user_id = ANY($1::uuid[])`, [users]);
  await q(`DELETE FROM public.profiles WHERE id = ANY($1::uuid[])`, [users]);
  await q(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [users]);
  await q(`DELETE FROM public.organizations WHERE id = ANY($1::uuid[])`, [orgs]);
}

beforeAll(async () => {
  if (!isLocal) return;
  const c = new pg.Client({ connectionString: LOCAL_DB_URL, connectionTimeoutMillis: 4000 });
  try {
    await c.connect();
    const { rows } = await c.query(
      `SELECT COUNT(*)::int AS n FROM pg_proc WHERE proname = 'custom_access_token_hook'`,
    );
    if (Number(rows[0]?.n) !== 1) {
      await c.end();
      return;
    }
    client = c;
    dbAvailable = true;
  } catch {
    try {
      await c.end();
    } catch {
      /* noop */
    }
    return;
  }

  await cleanup();

  // Orgs
  await createOrg(ids.providerOrg, "provider", "ACTIVE", null);
  await createOrg(ids.customerOrg, "customer", "ACTIVE", ids.providerOrg);
  await createOrg(ids.customerOrgB, "customer", "ACTIVE", ids.providerOrg);
  await createOrg(ids.archivedOrg, "customer", "CLOSED", ids.providerOrg);

  // Users
  await createUser(ids.userNone, "hook-none@test.local");
  await createUser(ids.userOrderer, "hook-orderer@test.local");
  await createUser(ids.userMulti, "hook-multi@test.local");
  await createUser(ids.userSuspended, "hook-suspended@test.local");
  await createUser(ids.userArchived, "hook-archived@test.local");
  await createUser(ids.userPlatformAdmin, "hook-pa@test.local");
  await createUser(ids.userProviderAdmin, "hook-provadmin@test.local");
  await createUser(ids.userCompanyAdmin, "hook-compadmin@test.local");
  await createUser(ids.userBadPreferred, "hook-badpref@test.local");

  // Memberships
  await addMembership(ids.userOrderer, ids.customerOrg, "orderer", "active");
  await addMembership(ids.userMulti, ids.customerOrg, "orderer", "active");
  await addMembership(ids.userMulti, ids.customerOrgB, "company_admin", "active");
  await addMembership(ids.userSuspended, ids.customerOrg, "orderer", "suspended");
  await addMembership(ids.userArchived, ids.archivedOrg, "orderer", "active");
  await addMembership(ids.userProviderAdmin, ids.providerOrg, "provider_admin", "active");
  await addMembership(ids.userCompanyAdmin, ids.customerOrg, "company_admin", "active");
  const badPrefMembership = await addMembership(ids.userBadPreferred, ids.customerOrg, "orderer", "active");
  const suspendedForBadPref = await addMembership(ids.userBadPreferred, ids.customerOrgB, "company_admin", "suspended");

  // Platform admin
  await q(`INSERT INTO public.platform_admins (user_id, source) VALUES ($1, 'vitest') ON CONFLICT DO NOTHING`, [
    ids.userPlatformAdmin,
  ]);

  // Invalid preferred membership: points at a SUSPENDED membership → must fall back deterministically.
  await q(`UPDATE public.profiles SET preferred_spine_membership_id = $1 WHERE id = $2`, [
    suspendedForBadPref,
    ids.userBadPreferred,
  ]);
  void badPrefMembership;
}, 60000);

afterAll(async () => {
  if (client) {
    try {
      await cleanup();
    } finally {
      await client.end();
    }
  }
});

/** Runtime skip: dbAvailable is only known after beforeAll (collection-time skipIf would always skip). */
function dbTest(name: string, fn: () => Promise<void>) {
  test(name, async (ctx) => {
    if (!dbAvailable) return ctx.skip();
    await fn();
  });
}

describe("custom_access_token_hook claim matrix (A1)", () => {
  dbTest("null membership: no active_* claims, empty memberships array", async () => {
    const claims = await callHook(ids.userNone);
    expect(claims.is_platform_admin).toBe(false);
    expect(claims.memberships).toEqual([]);
    expect(claims.active_org_id).toBeUndefined();
    expect(claims.active_role).toBeUndefined();
    expect(claims.active_location_id).toBeUndefined();
  });

  dbTest("one membership (employee/orderer): active claims minted", async () => {
    const claims = await callHook(ids.userOrderer);
    expect(claims.active_org_id).toBe(ids.customerOrg);
    expect(claims.active_role).toBe("orderer");
    expect(claims.memberships.length).toBe(1);
  });

  dbTest("multiple memberships: deterministic priority (company_admin first)", async () => {
    const claims = await callHook(ids.userMulti);
    expect(claims.memberships.length).toBe(2);
    expect(claims.active_role).toBe("company_admin");
    expect(claims.active_org_id).toBe(ids.customerOrgB);
  });

  dbTest("suspended membership: excluded entirely (fail-closed)", async () => {
    const claims = await callHook(ids.userSuspended);
    expect(claims.memberships).toEqual([]);
    expect(claims.active_org_id).toBeUndefined();
    expect(claims.active_role).toBeUndefined();
  });

  dbTest("archived organization: membership excluded, no claims minted", async () => {
    const claims = await callHook(ids.userArchived);
    expect(claims.memberships).toEqual([]);
    expect(claims.active_org_id).toBeUndefined();
    expect(claims.active_role).toBeUndefined();
  });

  dbTest("platform admin (superadmin): is_platform_admin=true, no org claims without memberships", async () => {
    const claims = await callHook(ids.userPlatformAdmin);
    expect(claims.is_platform_admin).toBe(true);
    expect(claims.active_org_id).toBeUndefined();
    expect(claims.active_role).toBeUndefined();
  });

  dbTest("provider admin: active_role=provider_admin on provider org", async () => {
    const claims = await callHook(ids.userProviderAdmin);
    expect(claims.active_org_id).toBe(ids.providerOrg);
    expect(claims.active_role).toBe("provider_admin");
    expect(claims.is_platform_admin).toBe(false);
  });

  dbTest("company admin: active_role=company_admin on customer org", async () => {
    const claims = await callHook(ids.userCompanyAdmin);
    expect(claims.active_org_id).toBe(ids.customerOrg);
    expect(claims.active_role).toBe("company_admin");
  });

  dbTest("invalid preferred membership (suspended): deterministic fallback to valid membership", async () => {
    const claims = await callHook(ids.userBadPreferred);
    // preferred points at a suspended membership → hook must not honor it
    expect(claims.active_org_id).toBe(ids.customerOrg);
    expect(claims.active_role).toBe("orderer");
  });

  dbTest("stale inbound claims are not trusted: active_org_id recomputed", async () => {
    const claims = await callHook(ids.userOrderer, {
      active_org_id: "00000000-0000-0000-0000-000000000099",
      is_platform_admin: true,
    });
    expect(claims.active_org_id).toBe(ids.customerOrg);
    expect(claims.is_platform_admin).toBe(false);
  });

  dbTest("fail-safe: invalid user_id returns event unchanged", async () => {
    const { rows } = await q(`SELECT public.custom_access_token_hook($1::jsonb) AS result`, [
      JSON.stringify({ user_id: "not-a-uuid", claims: { keep: true } }),
    ]);
    const parsed = typeof rows[0]?.result === "string" ? JSON.parse(rows[0].result) : rows[0]?.result;
    expect(parsed.claims).toEqual({ keep: true });
  });
});
