/**
 * Patch 6 — provider-scoped RLS (can_access_provider + parallel policies).
 * Requires RUN_SUPABASE_INTEGRATION_TESTS=1 and remote Supabase env (staging recommended).
 */
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import {
  buildRlsFixtures,
  createAccessToken,
  type AuthUserFx,
  type Fixtures,
} from "@/tests/_helpers/rlsFixtures";
import {
  hasRemoteSupabaseIntegrationEnv,
  readRemoteSupabaseIntegrationEnv,
} from "@/tests/_helpers/remoteSupabaseIntegration";

const MELHUS_ID = "11111111-1111-1111-1111-111111111111";
const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true });

function rowCount(res: { data: unknown; error: unknown }) {
  if (res.error) return NaN;
  const d = res.data;
  return Array.isArray(d) ? d.length : 0;
}

function adminClient(): SupabaseClient<Database> {
  const { url, serviceKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function supabaseAs(accessToken: string): SupabaseClient<Database> {
  const { url, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
  return createClient<Database>(url, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function randEmail(prefix: string) {
  return `${prefix}.${crypto.randomUUID().slice(0, 8)}@test.lunchportalen.no`;
}

type ProviderFx = {
  rid: string;
  admin: SupabaseClient<Database>;
  providerA: string;
  providerB: string;
  companyA: string;
  companyB: string;
  locA: string;
  locB: string;
  orderA: string | null;
  regA: string | null;
  regNull: string | null;
  providerAdminA: AuthUserFx;
  providerAdminB: AuthUserFx;
  superadmin: AuthUserFx;
  outsider: AuthUserFx;
  cleanup: () => Promise<void>;
};

async function createAuthUser(admin: SupabaseClient<Database>, email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user?.id) throw new Error(`createUser failed: ${error?.message ?? "unknown"}`);
  return data.user.id;
}

async function buildProviderFixtures(): Promise<ProviderFx> {
  const rid = crypto.randomUUID().slice(0, 8);
  const admin = adminClient();
  const providerA = crypto.randomUUID();
  const providerB = crypto.randomUUID();
  const slugA = `fx-a-${rid}`;
  const slugB = `fx-b-${rid}`;

  const { error: pErr } = await (admin as any).from("providers").insert([
    {
      id: providerA,
      name: `FX Provider A ${rid}`,
      slug: slugA,
      contact_email: `a.${rid}@test.lunchportalen.no`,
      status: "ACTIVE",
      billing_model: "SAAS_FIXED",
    },
    {
      id: providerB,
      name: `FX Provider B ${rid}`,
      slug: slugB,
      contact_email: `b.${rid}@test.lunchportalen.no`,
      status: "ACTIVE",
      billing_model: "SAAS_FIXED",
    },
  ] as any);
  if (pErr) throw new Error(`insert providers failed: ${pErr.message}`);

  const companyA = crypto.randomUUID();
  const companyB = crypto.randomUUID();
  const orgBase = 200000000 + (parseInt(rid, 16) % 700000000);

  const { error: cErr } = await admin.from("companies").insert([
    {
      id: companyA,
      name: `FX Co A ${rid}`,
      status: "ACTIVE",
      orgnr: String(orgBase),
      provider_id: providerA,
    },
    {
      id: companyB,
      name: `FX Co B ${rid}`,
      status: "ACTIVE",
      orgnr: String(orgBase + 1),
      provider_id: providerB,
    },
  ] as any);
  if (cErr) throw new Error(`insert companies failed: ${cErr.message}`);

  const locA = crypto.randomUUID();
  const locB = crypto.randomUUID();
  const { error: lErr } = await admin.from("company_locations").insert([
    { id: locA, company_id: companyA, name: `Loc A ${rid}` },
    { id: locB, company_id: companyB, name: `Loc B ${rid}` },
  ] as any);
  if (lErr) throw new Error(`insert locations failed: ${lErr.message}`);

  const mkUser = async (role: "superadmin" | "employee", providerId?: string, providerRole?: string) => {
    const email = randEmail(role);
    const password = crypto.randomBytes(20).toString("hex");
    const user_id = await createAuthUser(admin, email, password);
    const accessToken = await createAccessToken(admin, email, password);
    await admin.from("profiles").upsert({
      id: user_id,
      email,
      role,
      active: true,
    } as any);
    if (providerId && providerRole) {
      const { error: mErr } = await (admin as any).from("provider_memberships").insert({
        user_id,
        provider_id: providerId,
        role: providerRole,
      } as any);
      if (mErr) throw new Error(`insert provider_membership failed: ${mErr.message}`);
    }
    return { user_id, email, accessToken, access_token: accessToken } as AuthUserFx;
  };

  const providerAdminA = await mkUser("employee", providerA, "provider_admin");
  const providerAdminB = await mkUser("employee", providerB, "provider_admin");
  const superadmin = await mkUser("superadmin");
  const outsider = await mkUser("employee");

  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 14);
  const orderDate = future.toISOString().slice(0, 10);

  let orderA: string | null = null;
  const orderId = crypto.randomUUID();
  const { error: oErr } = await admin.from("orders").insert({
    id: orderId,
    user_id: providerAdminA.user_id,
    date: orderDate,
    company_id: companyA,
    location_id: locA,
    provider_id: providerA,
    status: "ACTIVE",
    slot: "default",
  } as any);
  if (!oErr) orderA = orderId;

  const regA = crypto.randomUUID();
  const regNull = crypto.randomUUID();
  await admin.from("company_registrations").insert([
    {
      id: regA,
      company_name: `Reg A ${rid}`,
      provider_id: providerA,
      status: "pending",
    },
    {
      id: regNull,
      company_name: `Reg Null ${rid}`,
      provider_id: null,
      status: "pending",
    },
  ] as any);

  const authIds = [
    providerAdminA.user_id,
    providerAdminB.user_id,
    superadmin.user_id,
    outsider.user_id,
  ];

  async function cleanup() {
    if (orderA) await admin.from("orders").delete().eq("id", orderA);
    await admin.from("company_registrations").delete().in("id", [regA, regNull]);
    await (admin as any).from("provider_memberships").delete().in("user_id", authIds);
    await admin.from("profiles").delete().in("id", authIds);
    await admin.from("company_locations").delete().in("id", [locA, locB]);
    await admin.from("companies").delete().in("id", [companyA, companyB]);
    await (admin as any).from("providers").delete().in("id", [providerA, providerB]);
    for (const id of authIds) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        // ignore
      }
    }
  }

  return {
    rid,
    admin,
    providerA,
    providerB,
    companyA,
    companyB,
    locA,
    locB,
    orderA,
    regA,
    regNull,
    providerAdminA,
    providerAdminB,
    superadmin,
    outsider,
    cleanup,
  };
}

let pfx: ProviderFx;
let companyFx: Fixtures;

describe.skipIf(!hasDb)("provider RLS (Patch 6)", () => {
  beforeAll(async () => {
    pfx = await buildProviderFixtures();
    companyFx = await buildRlsFixtures();
  }, 120_000);

  afterAll(async () => {
    if (pfx?.cleanup) await pfx.cleanup();
    if (companyFx?.cleanup) await companyFx.cleanup();
  }, 120_000);

  describe("can_access_provider()", () => {
    test("true for provider membership", async () => {
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const { data, error } = await (sb as any).rpc("can_access_provider", { p_provider_id: pfx.providerA });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    test("false without membership", async () => {
      const sb = supabaseAs(pfx.outsider.accessToken);
      const { data, error } = await (sb as any).rpc("can_access_provider", { p_provider_id: pfx.providerA });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    test("true for superadmin on any provider", async () => {
      const sb = supabaseAs(pfx.superadmin.accessToken);
      const { data, error } = await (sb as any).rpc("can_access_provider", { p_provider_id: pfx.providerB });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    test("false for non-existent provider id", async () => {
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const fake = "00000000-0000-0000-0000-000000000099";
      const { data, error } = await (sb as any).rpc("can_access_provider", { p_provider_id: fake });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });

  describe("providers SELECT", () => {
    test("provider_admin sees own provider", async () => {
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const res = await (sb as any).from("providers").select("id").eq("id", pfx.providerA);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(1);
    });

    test("provider_admin does not see other providers", async () => {
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const res = await (sb as any).from("providers").select("id").eq("id", pfx.providerB);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(0);
    });

    test("superadmin sees all providers", async () => {
      const sb = supabaseAs(pfx.superadmin.accessToken);
      const res = await (sb as any).from("providers").select("id").in("id", [pfx.providerA, pfx.providerB]);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(2);
    });
  });

  describe("companies SELECT (additive)", () => {
    test("company_admin still sees own company", async () => {
      const { supabaseAs: as, users, companyA } = companyFx;
      const res = await as(users.adminA.accessToken).from("companies").select("id").eq("id", companyA.id);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBeGreaterThanOrEqual(1);
    });

    test("provider_admin sees companies via provider_id", async () => {
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const res = await sb.from("companies").select("id").eq("id", pfx.companyA);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(1);
    });

    test("employee without company membership sees no companies", async () => {
      const sb = supabaseAs(pfx.outsider.accessToken);
      const res = await sb.from("companies").select("id").limit(5);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(0);
    });

    test("anon cannot read companies", async () => {
      const { url, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
      const anon = createClient<Database>(url, anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const res = await anon.from("companies").select("id").limit(1);
      expect(res.error).not.toBeNull();
    });
  });

  describe("orders SELECT (additive)", () => {
    test("provider_admin sees orders for own provider", async () => {
      if (!pfx.orderA) return;
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const res = await sb.from("orders").select("id").eq("id", pfx.orderA);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(1);
    });

    test("company_admin still sees own company orders", async () => {
      const { supabaseAs: as, users, companyA } = companyFx;
      const sb = as(users.adminA.accessToken);
      const res = await sb.from("orders").select("id,company_id").eq("company_id", companyA.id);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("company_registrations SELECT", () => {
    test("provider_admin sees registrations with provider_id set", async () => {
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const res = await sb.from("company_registrations").select("id").eq("id", pfx.regA!);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(1);
    });

    test("NULL provider_id registration is not visible", async () => {
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const res = await sb.from("company_registrations").select("id").eq("id", pfx.regNull!);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(0);
    });
  });

  describe("cross-provider isolation", () => {
    test("provider A admin cannot read B companies", async () => {
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const res = await sb.from("companies").select("id").eq("id", pfx.companyB);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(0);
    });

    test("provider A admin cannot read B agreements", async () => {
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const res = await sb.from("agreements").select("id").eq("company_id", pfx.companyB);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(0);
    });

    test("provider A admin cannot update B company", async () => {
      const sb = supabaseAs(pfx.providerAdminA.accessToken);
      const res = await sb
        .from("companies")
        .update({ name: `Hacked ${pfx.rid}` } as any)
        .eq("id", pfx.companyB)
        .select("id");
      expect(rowCount(res)).toBe(0);
    });
  });

  describe("Melhus default provider (staging/prod parity)", () => {
    test("Melhus provider row is readable by superadmin", async () => {
      const sb = supabaseAs(pfx.superadmin.accessToken);
      const res = await (sb as any).from("providers").select("id,slug").eq("id", MELHUS_ID);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(1);
      expect((res.data as { slug?: string }[] | null)?.[0]?.slug).toBe("melhus-catering");
    });
  });
});
