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

describe.skipIf(!hasDb)("lp_provider_get_connection_health (TPT-B-7)", () => {
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

  test("CONNECTED state: full stats shape", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({ providerId: fx.providerA, state: "CONNECTED", companyId: 114612665 });

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { data, error } = await (sb as any).rpc("lp_provider_get_connection_health", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).toBeNull();
    expect(data?.state).toBe("CONNECTED");
    expect(data?.tripletex_company_id).toBe(114612665);
    expect(data?.stats_30d).toBeTruthy();
    expect(Array.isArray(data?.recent_events)).toBe(true);
  });

  test("DEGRADED state: includes warnings", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    await seedCredentialsRow({ providerId: fx.providerA, state: "DEGRADED" });

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { data, error } = await (sb as any).rpc("lp_provider_get_connection_health", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).toBeNull();
    expect(data?.state).toBe("DEGRADED");
    expect((data?.warnings ?? []).length).toBeGreaterThan(0);
  });

  test("read access for provider_viewer role", async () => {
    await seedCredentialsRow({ providerId: fx.providerA, state: "CONNECTED" });
    await fixturePgQuery(
      `INSERT INTO public.provider_memberships (user_id, provider_id, role)
       VALUES ($1, $2, 'provider_viewer')
       ON CONFLICT (user_id, provider_id) DO UPDATE SET role = EXCLUDED.role`,
      [fx.outsider.user_id, fx.providerA],
    );

    const sb = authenticatedClient(fx.outsider.accessToken);
    const { data, error } = await (sb as any).rpc("lp_provider_get_connection_health", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).toBeNull();
    expect(data?.state).toBe("CONNECTED");

    await fixturePgQuery(
      `DELETE FROM public.provider_memberships WHERE user_id = $1 AND provider_id = $2`,
      [fx.outsider.user_id, fx.providerA],
    );
  });
});
