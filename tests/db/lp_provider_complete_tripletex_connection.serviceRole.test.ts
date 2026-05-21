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
  MOCK_VERIFICATION_OK,
} from "@/tests/db/_helpers/tripletexOnboardingFixtures";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });
const COMPANY_ID = 114612665;

describe.skipIf(!hasDb)(
  "lp_provider_complete_tripletex_connection — service_role flow (TPT-B-7b)",
  () => {
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

    test("service_role passerer guard og oppretter CONFIGURING-tilkobling", async () => {
      await cleanupTripletexOnboarding(fx.providerA);
      const admin = serviceRoleClient();
      const { data, error } = await (admin as any).rpc("lp_provider_complete_tripletex_connection", {
        p_provider_id: fx.providerA,
        p_env: "test",
        p_tripletex_company_id: COMPANY_ID,
        p_employee_token: "emp-token-service-role",
        p_consumer_token: "consumer-token-service-role",
        p_verification_result: MOCK_VERIFICATION_OK,
      });
      expect(error).toBeNull();
      expect(data?.connection_state).toBe("CONFIGURING");
      expect(data?.provisioning_started).toBe(true);

      const row = await fixturePgQuery<{ connection_state: string }>(
        `SELECT connection_state FROM public.provider_tripletex_credentials WHERE provider_id = $1`,
        [fx.providerA],
      );
      expect(row.rows[0]?.connection_state).toBe("CONFIGURING");
    });

    test("provider_admin-JWT med verification_result → trusted-app-layer PERMISSION_DENIED", async () => {
      const user = authenticatedClient(fx.providerAdminA.accessToken);
      const { error } = await (user as any).rpc("lp_provider_complete_tripletex_connection", {
        p_provider_id: fx.providerA,
        p_env: "test",
        p_tripletex_company_id: COMPANY_ID,
        p_employee_token: "emp-token-jwt",
        p_consumer_token: "consumer-token-jwt",
        p_verification_result: MOCK_VERIFICATION_OK,
      });
      expect(error).not.toBeNull();
      expect(String(error?.message ?? "")).toMatch(/complete requires trusted app-layer verification/i);
    });
  },
);
