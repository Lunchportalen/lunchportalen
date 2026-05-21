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
  MOCK_VERIFICATION_AUTH_FAIL,
} from "@/tests/db/_helpers/tripletexOnboardingFixtures";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });
const COMPANY_ID = 114612665;

describe.skipIf(!hasDb)("lp_provider_complete_tripletex_connection (TPT-B-7)", () => {
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

  test("happy: persist token, state CONFIGURING, outbox event", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    const admin = authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await (admin as any).rpc("lp_provider_complete_tripletex_connection", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_employee_token: "emp-token-test",
      p_consumer_token: "consumer-token-test",
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

    const outbox = await fixturePgQuery<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.outbox
       WHERE event_key = $1`,
      [`tripletex.onboarding_provisioning_start:${fx.providerA}:test`],
    );
    expect(Number(outbox.rows[0]?.c)).toBeGreaterThanOrEqual(1);
  });

  test("failed re-verify → exception, no state change", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    const admin = authenticatedClient(fx.superadmin.accessToken);
    const { error } = await (admin as any).rpc("lp_provider_complete_tripletex_connection", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_employee_token: "emp-token-test",
      p_consumer_token: "consumer-token-test",
      p_verification_result: MOCK_VERIFICATION_AUTH_FAIL,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/VERIFICATION_FAILED/i);

    const row = await fixturePgQuery<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.provider_tripletex_credentials WHERE provider_id = $1`,
      [fx.providerA],
    );
    expect(Number(row.rows[0]?.c)).toBe(0);
  });

  test("idempotent: second call while CONFIGURING", async () => {
    await cleanupTripletexOnboarding(fx.providerA);
    const admin = authenticatedClient(fx.superadmin.accessToken);
    const args = {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_employee_token: "emp-token-test",
      p_consumer_token: "consumer-token-test",
      p_verification_result: MOCK_VERIFICATION_OK,
    };
    await (admin as any).rpc("lp_provider_complete_tripletex_connection", args);
    const { data, error } = await (admin as any).rpc("lp_provider_complete_tripletex_connection", args);
    expect(error).toBeNull();
    expect(data?.idempotent).toBe(true);
  });

  test("auth check: outsider denied", async () => {
    const sb = authenticatedClient(fx.outsider.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_complete_tripletex_connection", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_tripletex_company_id: COMPANY_ID,
      p_employee_token: "emp",
      p_consumer_token: "con",
      p_verification_result: MOCK_VERIFICATION_OK,
    });
    expect(error).not.toBeNull();
  });
});
