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
  MOCK_VERIFICATION_AUTH_FAIL,
  MOCK_VERIFICATION_MISMATCH,
  MOCK_VERIFICATION_OK,
  MOCK_VERIFICATION_SCOPE_FAIL,
} from "@/tests/db/_helpers/tripletexOnboardingFixtures";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });
const COMPANY_ID = 114612665;

describe.skipIf(!hasDb)("lp_provider_test_tripletex_token (TPT-B-7)", () => {
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

  test("happy path: all three verifications pass → all_passed=true", async () => {
    const admin = authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await (admin as any).rpc("lp_provider_test_tripletex_token", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_verification_result: MOCK_VERIFICATION_OK,
    });
    expect(error).toBeNull();
    expect(data?.all_passed).toBe(true);
  });

  test("whoAmI 401 → auth.ok=false reflected in result", async () => {
    const admin = authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await (admin as any).rpc("lp_provider_test_tripletex_token", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_verification_result: MOCK_VERIFICATION_AUTH_FAIL,
    });
    expect(error).toBeNull();
    expect(data?.auth?.ok).toBe(false);
    expect(data?.all_passed).toBe(false);
  });

  test("company mismatch → company_match.ok=false", async () => {
    const admin = authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await (admin as any).rpc("lp_provider_test_tripletex_token", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_verification_result: MOCK_VERIFICATION_MISMATCH,
    });
    expect(error).toBeNull();
    expect(data?.auth?.ok).toBe(true);
    expect(data?.company_match?.ok).toBe(false);
    expect(data?.all_passed).toBe(false);
  });

  test("scope 403 → scope.ok=false", async () => {
    const admin = authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await (admin as any).rpc("lp_provider_test_tripletex_token", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_verification_result: MOCK_VERIFICATION_SCOPE_FAIL,
    });
    expect(error).toBeNull();
    expect(data?.scope?.ok).toBe(false);
    expect(data?.all_passed).toBe(false);
  });

  test("authorization: provider_admin other provider → permission denied", async () => {
    const sb = authenticatedClient(fx.providerAdminB.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_test_tripletex_token", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_verification_result: MOCK_VERIFICATION_OK,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED|permission denied/i);
  });
});
