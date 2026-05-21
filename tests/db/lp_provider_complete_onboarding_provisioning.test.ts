import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { closeFixturePgPool, fixturePgQuery } from "@/tests/_helpers/fixturePg";
import {
  buildProviderTestFixtures,
  type ProviderTestFixtures,
} from "@/tests/_helpers/providerTestFixtures";
import { hasRemoteSupabaseIntegrationEnv } from "@/tests/_helpers/remoteSupabaseIntegration";
import { authenticatedClient, serviceRoleClient } from "@/tests/_helpers/supabaseTestClient";
import {
  cleanupTripletexOnboarding,
  seedCredentialsRow,
} from "@/tests/db/_helpers/tripletexOnboardingFixtures";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

describe.skipIf(!hasDb)("lp_provider_complete_onboarding_provisioning (TPT-B-7)", () => {
  let fx: ProviderTestFixtures;

  beforeAll(async () => {
    fx = await buildProviderTestFixtures({ includeEmployee: false, requireOrder: false });
    await (serviceRoleClient() as any).rpc("lp_pgrst_reload_schema");
  }, 180_000);

  afterAll(async () => {
    if (fx?.providerA) await cleanupTripletexOnboarding(fx.providerA);
    if (fx?.cleanup) await fx.cleanup();
    await closeFixturePgPool();
  }, 180_000);

  test("happy: returns summary", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({ providerId: fx.providerA, state: "CONFIGURING" });

    const admin = serviceRoleClient();
    const summary = {
      vat_codes_ensured: 3,
      products_ensured: 3,
      customers_ensured: 5,
      customers_skipped: 0,
      skipped_details: [],
      duration_ms: 1200,
    };
    const { data, error } = await (admin as any).rpc("lp_provider_complete_onboarding_provisioning", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_summary: summary,
    });
    expect(error).toBeNull();
    expect(data?.vat_codes_ensured).toBe(3);
    expect(data?.customers_ensured).toBe(5);

    const row = await fixturePgQuery<{ onboarding_provisioning_complete_at: string | null }>(
      `SELECT onboarding_provisioning_complete_at FROM public.provider_tripletex_credentials WHERE provider_id = $1`,
      [fx.providerA],
    );
    expect(row.rows[0]?.onboarding_provisioning_complete_at).toBeTruthy();
  });

  test("with skipped customers", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({ providerId: fx.providerA, state: "CONFIGURING" });

    const admin = serviceRoleClient();
    const { data, error } = await (admin as any).rpc("lp_provider_complete_onboarding_provisioning", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_summary: {
        vat_codes_ensured: 3,
        products_ensured: 3,
        customers_ensured: 2,
        customers_skipped: 1,
        skipped_details: [{ company_id: fx.companyA, reason: "MISSING_ORG_NUMBER" }],
        duration_ms: 800,
      },
    });
    expect(error).toBeNull();
    expect(data?.customers_skipped).toBe(1);
  });

  test("service_role-only auth", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({ providerId: fx.providerA, state: "CONFIGURING" });
    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_complete_onboarding_provisioning", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_summary: { vat_codes_ensured: 1 },
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED|service_role/i);
  });

  test("idempotent second call", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({ providerId: fx.providerA, state: "CONFIGURING" });
    const admin = serviceRoleClient();
    const summary = { vat_codes_ensured: 3, products_ensured: 3, customers_ensured: 0, customers_skipped: 0 };
    await (admin as any).rpc("lp_provider_complete_onboarding_provisioning", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_summary: summary,
    });
    const { data, error } = await (admin as any).rpc("lp_provider_complete_onboarding_provisioning", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_summary: summary,
    });
    expect(error).toBeNull();
    expect(data?.idempotent).toBe(true);
  });
});
