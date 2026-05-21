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

describe.skipIf(!hasDb)("lp_provider_disconnect_tripletex (TPT-B-7)", () => {
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

  test("happy: DISCONNECTED + vault_purge_at ~30d", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({ providerId: fx.providerA, state: "CONNECTED" });

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { data, error } = await (sb as any).rpc("lp_provider_disconnect_tripletex", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).toBeNull();
    expect(data?.connection_state).toBe("DISCONNECTED");
    expect(data?.days_until_purge).toBe(30);

    const row = await fixturePgQuery<{ connection_state: string; vault_purge_at: string | null }>(
      `SELECT connection_state, vault_purge_at FROM public.provider_tripletex_credentials WHERE provider_id = $1`,
      [fx.providerA],
    );
    expect(row.rows[0]?.connection_state).toBe("DISCONNECTED");
    expect(row.rows[0]?.vault_purge_at).toBeTruthy();
  });

  test("idempotent on already DISCONNECTED", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({
      providerId: fx.providerA,
      state: "DISCONNECTED",
      disconnected: true,
      vaultPurgeAt: new Date(Date.now() + 20 * 86400000).toISOString(),
    });

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { data, error } = await (sb as any).rpc("lp_provider_disconnect_tripletex", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).toBeNull();
    expect(data?.idempotent).toBe(true);
  });

  test("auth check: outsider denied", async () => {
    await seedCredentialsRow({ providerId: fx.providerA, state: "CONNECTED" });
    const sb = authenticatedClient(fx.outsider.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_disconnect_tripletex", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).not.toBeNull();
  });
});
