import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { closeFixturePgPool } from "@/tests/_helpers/fixturePg";
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

describe.skipIf(!hasDb)("lp_provider_reconnect_tripletex (TPT-B-7)", () => {
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

  test("within grace: CONFIGURING, dates cleared", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({
      providerId: fx.providerA,
      state: "DISCONNECTED",
      disconnected: true,
      vaultPurgeAt: new Date(Date.now() + 15 * 86400000).toISOString(),
    });

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { data, error } = await (sb as any).rpc("lp_provider_reconnect_tripletex", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).toBeNull();
    expect(data?.connection_state).toBe("CONFIGURING");
    expect(data?.validation_required).toBe(true);
  });

  test("outside grace → exception", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({
      providerId: fx.providerA,
      state: "DISCONNECTED",
      disconnected: true,
      vaultPurgeAt: new Date(Date.now() - 86400000).toISOString(),
    });

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_reconnect_tripletex", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/GRACE_PERIOD_EXPIRED/i);
  });

  test("wrong state CONNECTED → exception", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({ providerId: fx.providerA, state: "CONNECTED" });

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_reconnect_tripletex", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/INVALID_STATE_FOR_RECONNECT/i);
  });
});
