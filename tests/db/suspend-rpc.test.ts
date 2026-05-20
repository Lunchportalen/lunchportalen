/**
 * Patch 7 — lifecycle suspend/pause/delete RPCs (integration, opt-in).
 */
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { DEFAULT_PROVIDER_ID } from "@/tests/_helpers/rlsFixtures";
import { createAccessToken } from "@/tests/_helpers/rlsFixtures";
import {
  hasRemoteSupabaseIntegrationEnv,
  readRemoteSupabaseIntegrationEnv,
} from "@/tests/_helpers/remoteSupabaseIntegration";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true });
const REASON_OK = "Integrasjonstest Patch7 — tilstrekkelig lang begrunnelse.";
const REASON_SHORT = "for kort";

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

type Fx = {
  admin: SupabaseClient<Database>;
  providerA: string;
  providerB: string;
  companyA: string;
  companyB: string;
  locA: string;
  orderA: string;
  employeeA: { user_id: string; accessToken: string };
  providerAdminA: { user_id: string; accessToken: string };
  providerAdminB: { user_id: string; accessToken: string };
  superadmin: { user_id: string; accessToken: string };
  cleanup: () => Promise<void>;
};

async function createUser(admin: SupabaseClient<Database>, prefix: string) {
  const email = `${prefix}.${crypto.randomUUID().slice(0, 8)}@test.lunchportalen.no`;
  const password = crypto.randomBytes(20).toString("hex");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user?.id) throw new Error(error?.message ?? "createUser failed");
  const accessToken = await createAccessToken(admin, email, password);
  return { user_id: data.user.id, accessToken };
}

async function buildFx(): Promise<Fx> {
  const admin = adminClient();
  const rid = crypto.randomUUID().slice(0, 8);
  const providerA = crypto.randomUUID();
  const providerB = crypto.randomUUID();

  await (admin as any).from("providers").insert([
    {
      id: providerA,
      name: `Suspend A ${rid}`,
      slug: `suspend-a-${rid}`,
      contact_email: `a.${rid}@test.lunchportalen.no`,
      status: "ACTIVE",
      billing_model: "SAAS_FIXED",
    },
    {
      id: providerB,
      name: `Suspend B ${rid}`,
      slug: `suspend-b-${rid}`,
      contact_email: `b.${rid}@test.lunchportalen.no`,
      status: "ACTIVE",
      billing_model: "SAAS_FIXED",
    },
  ]);

  const companyA = crypto.randomUUID();
  const companyB = crypto.randomUUID();
  const orgBase = 300000000 + (parseInt(rid, 16) % 500000000);

  await admin.from("companies").insert([
    {
      id: companyA,
      name: `Co A ${rid}`,
      status: "ACTIVE",
      orgnr: String(orgBase),
      provider_id: providerA,
    },
    {
      id: companyB,
      name: `Co B ${rid}`,
      status: "ACTIVE",
      orgnr: String(orgBase + 1),
      provider_id: providerB,
    },
  ] as any);

  const locA = crypto.randomUUID();
  await admin.from("company_locations").insert({ id: locA, company_id: companyA, name: `Loc ${rid}` } as any);

  const providerAdminA = await createUser(admin, "provadmin-a");
  const providerAdminB = await createUser(admin, "provadmin-b");
  const employeeA = await createUser(admin, "employee-a");
  const superadmin = await createUser(admin, "superadmin");

  await admin.from("profiles").upsert([
    { id: providerAdminA.user_id, email: `pa-${rid}@test.lunchportalen.no`, role: "employee", active: true },
    { id: providerAdminB.user_id, email: `pb-${rid}@test.lunchportalen.no`, role: "employee", active: true },
    { id: employeeA.user_id, email: `emp-${rid}@test.lunchportalen.no`, role: "employee", company_id: companyA, active: true },
    { id: superadmin.user_id, email: `sa-${rid}@test.lunchportalen.no`, role: "superadmin", active: true },
  ] as any);

  await (admin as any).from("provider_memberships").insert([
    { user_id: providerAdminA.user_id, provider_id: providerA, role: "provider_admin" },
    { user_id: providerAdminB.user_id, provider_id: providerB, role: "provider_admin" },
  ]);

  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 21);
  const orderDate = future.toISOString().slice(0, 10);
  const orderA = crypto.randomUUID();

  await admin.from("orders").insert({
    id: orderA,
    user_id: employeeA.user_id,
    date: orderDate,
    company_id: companyA,
    location_id: locA,
    provider_id: providerA,
    status: "ACTIVE",
    slot: "default",
  } as any);

  const authIds = [
    providerAdminA.user_id,
    providerAdminB.user_id,
    employeeA.user_id,
    superadmin.user_id,
  ];

  async function cleanup() {
    await admin.from("orders").delete().eq("id", orderA);
    await (admin as any)
      .from("lifecycle_audit_log")
      .delete()
      .in("entity_id", [companyA, companyB, providerA, providerB, DEFAULT_PROVIDER_ID]);
    await (admin as any).from("provider_memberships").delete().in("user_id", authIds);
    await admin.from("profiles").delete().in("id", authIds);
    await admin.from("company_locations").delete().eq("id", locA);
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
    admin,
    providerA,
    providerB,
    companyA,
    companyB,
    locA,
    orderA,
    employeeA,
    providerAdminA,
    providerAdminB,
    superadmin,
    cleanup,
  };
}

describe.skipIf(!hasDb)("suspend RPC (Patch 7)", () => {
  let fx: Fx;

  beforeAll(async () => {
    fx = await buildFx();
  }, 120_000);

  afterAll(async () => {
    if (fx?.cleanup) await fx.cleanup();
  }, 120_000);

  test("reason shorter than 20 chars returns error", async () => {
    const sb = supabaseAs(fx.providerAdminA.accessToken);
    const { error } = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_SHORT,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/REASON_REQUIRED|20/i);
  });

  test("provider B admin cannot suspend company A", async () => {
    const sb = supabaseAs(fx.providerAdminB.accessToken);
    const { error } = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_OK,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED/i);
  });

  test("company suspend pauses active orders and writes audit", async () => {
    const sb = supabaseAs(fx.providerAdminA.accessToken);
    const { data, error } = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_OK,
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    expect(Number(data?.cascade_orders_paused ?? 0)).toBeGreaterThanOrEqual(1);

    const ord = await fx.admin.from("orders").select("status").eq("id", fx.orderA).single();
    expect(String(ord.data?.status ?? "").toUpperCase()).toBe("PAUSED");

    const audit = await (fx.admin as any)
      .from("lifecycle_audit_log")
      .select("action, entity_type, entity_id, metadata")
      .eq("entity_id", fx.companyA)
      .eq("action", "suspend")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(audit.error).toBeNull();
    expect(audit.data?.length).toBe(1);
    expect(Number(audit.data?.[0]?.metadata?.cascade_orders_paused ?? 0)).toBeGreaterThanOrEqual(1);

    const again = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_OK,
    });
    expect(again.error).toBeNull();
    expect(again.data?.already_suspended).toBe(true);

    await (sb as any).rpc("lp_company_resume", { p_company_id: fx.companyA });
  });

  test("employee cannot suspend company", async () => {
    const sb = supabaseAs(fx.employeeA.accessToken);
    const { error } = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_OK,
    });
    expect(error).not.toBeNull();
  });

  test("superadmin can suspend provider (Melhus smoke)", async () => {
    const sb = supabaseAs(fx.superadmin.accessToken);
    const { data, error } = await (sb as any).rpc("lp_provider_suspend", {
      p_provider_id: DEFAULT_PROVIDER_ID,
      p_reason: REASON_OK,
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    await (sb as any).rpc("lp_provider_resume", { p_provider_id: DEFAULT_PROVIDER_ID });
  });
});
