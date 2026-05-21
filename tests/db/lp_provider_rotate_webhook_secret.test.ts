/**
 * TPT-B-6 — lp_provider_rotate_webhook_secret (integration, opt-in).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { closeFixturePgPool, fixturePgQuery } from "@/tests/_helpers/fixturePg";
import {
  buildProviderTestFixtures,
  type ProviderTestFixtures,
} from "@/tests/_helpers/providerTestFixtures";
import { hasRemoteSupabaseIntegrationEnv } from "@/tests/_helpers/remoteSupabaseIntegration";
import { authenticatedClient, serviceRoleClient } from "@/tests/_helpers/supabaseTestClient";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

describe.skipIf(!hasDb)("lp_provider_rotate_webhook_secret", () => {
  let fx: ProviderTestFixtures;
  let firstSecret: string | null = null;

  beforeAll(async () => {
    fx = await buildProviderTestFixtures();
  }, 120_000);

  afterAll(async () => {
    await fixturePgQuery(
      `DELETE FROM public.provider_tripletex_webhook_secrets WHERE provider_id = $1`,
      [fx.providerA],
    ).catch(() => undefined);
    await fx?.cleanup?.();
    await closeFixturePgPool();
  });

  test("provider_admin for own provider → success, secret returned", async () => {
    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { data, error } = await sb.rpc("lp_provider_rotate_webhook_secret", {
      p_provider_id: fx.providerA,
      p_env: "prod",
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    expect(String(data?.webhook_secret ?? "").length).toBeGreaterThanOrEqual(32);
    firstSecret = String(data?.webhook_secret);
  });

  test("second rotation returns new secret (load RPC does not expose via authenticated)", async () => {
    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { data, error } = await sb.rpc("lp_provider_rotate_webhook_secret", {
      p_provider_id: fx.providerA,
      p_env: "prod",
    });
    expect(error).toBeNull();
    const second = String(data?.webhook_secret ?? "");
    expect(second.length).toBeGreaterThanOrEqual(32);
    expect(second).not.toBe(firstSecret);

    const admin = serviceRoleClient();
    const load = await admin.rpc("lp_provider_load_webhook_secret", {
      p_provider_id: fx.providerA,
      p_env: "prod",
    });
    expect(load.error).toBeNull();
    expect(load.data?.webhook_secret).toBe(second);
  });

  test("provider_admin for another provider → permission denied", async () => {
    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await sb.rpc("lp_provider_rotate_webhook_secret", {
      p_provider_id: fx.providerB,
      p_env: "prod",
    });
    expect(error).toBeTruthy();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED|42501/i);
  });
});
