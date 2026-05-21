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
  MOCK_VERIFICATION_OK,
} from "@/tests/db/_helpers/tripletexOnboardingFixtures";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });
const COMPANY_ID = 114612665;

describe.skipIf(!hasDb)("lp_provider_test_tripletex_token — service_role flow (TPT-B-7b)", () => {
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

  test("service_role passerer guard og lagrer verification_result", async () => {
    const admin = serviceRoleClient();
    const { data, error } = await (admin as any).rpc("lp_provider_test_tripletex_token", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_verification_result: MOCK_VERIFICATION_OK,
    });
    expect(error).toBeNull();
    expect(data?.all_passed).toBe(true);
  });

  test("service_role uten verification_result → VERIFICATION_REQUIRES_APP_LAYER (ikke assert PERMISSION_DENIED)", async () => {
    const admin = serviceRoleClient();
    const { error } = await (admin as any).rpc("lp_provider_test_tripletex_token", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_verification_result: null,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/VERIFICATION_REQUIRES_APP_LAYER/i);
    expect(String(error?.message ?? "")).not.toMatch(/^PERMISSION_DENIED$/i);
  });

  test("provider-JWT uten provider_admin-rolle → PERMISSION_DENIED", async () => {
    const user = authenticatedClient(fx.outsider.accessToken);
    const { error } = await (user as any).rpc("lp_provider_test_tripletex_token", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_verification_result: MOCK_VERIFICATION_OK,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED|permission denied/i);
  });

  test("provider_admin-JWT med verification_result → trusted-app-layer PERMISSION_DENIED", async () => {
    const user = authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await (user as any).rpc("lp_provider_test_tripletex_token", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_verification_result: MOCK_VERIFICATION_OK,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(
      /verification result must be applied by trusted app layer/i,
    );
  });
});
