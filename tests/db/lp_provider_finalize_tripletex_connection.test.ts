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
  seedWebhookSecret,
} from "@/tests/db/_helpers/tripletexOnboardingFixtures";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

describe.skipIf(!hasDb)("lp_provider_finalize_tripletex_connection (TPT-B-7)", () => {
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

  test("happy: CONFIGURING → CONNECTED", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({
      providerId: fx.providerA,
      state: "CONFIGURING",
      provisioningComplete: true,
    });
    await seedWebhookSecret(fx.providerA, "test");

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { data, error } = await (sb as any).rpc("lp_provider_finalize_tripletex_connection", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).toBeNull();
    expect(data?.connection_state).toBe("CONNECTED");
    expect(data?.ready_for_billing).toBe(true);

    const row = await fixturePgQuery<{ connection_state: string }>(
      `SELECT connection_state FROM public.provider_tripletex_credentials WHERE provider_id = $1`,
      [fx.providerA],
    );
    expect(row.rows[0]?.connection_state).toBe("CONNECTED");
  });

  test("without provisioning complete → exception", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({ providerId: fx.providerA, state: "CONFIGURING" });
    await seedWebhookSecret(fx.providerA, "test");

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_finalize_tripletex_connection", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/PROVISIONING_NOT_COMPLETE/i);
  });

  test("without webhook secret → exception", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({
      providerId: fx.providerA,
      state: "CONFIGURING",
      provisioningComplete: true,
    });

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_finalize_tripletex_connection", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/WEBHOOK_SECRET_REQUIRED/i);
  });
});
