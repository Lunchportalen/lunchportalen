/**
 * TPT-B-1 — loadProviderCredentials + Vault-backed credential RPCs (integration, opt-in).
 */
import crypto from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { closeFixturePgPool, fixturePgQuery } from "@/tests/_helpers/fixturePg";
import {
  buildProviderTestFixtures,
  type ProviderTestFixtures,
} from "@/tests/_helpers/providerTestFixtures";
import { hasRemoteSupabaseIntegrationEnv } from "@/tests/_helpers/remoteSupabaseIntegration";
import { authenticatedClient, serviceRoleClient } from "@/tests/_helpers/supabaseTestClient";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();
  return {
    ...actual,
    supabaseAdmin: () => serviceRoleClient(),
  };
});

import {
  TripletexClientError,
  __clearTripletexSessionCacheForTests,
  resolveTripletexAuth,
} from "@/lib/integrations/tripletex/client";

const CONSUMER = "test-consumer-token-b1";
const EMPLOYEE = "test-employee-token-b1";
const COMPANY_ID = 123456;

async function cleanupCredentials(providerId: string) {
  await fixturePgQuery(
    `DELETE FROM public.lifecycle_audit_log
     WHERE entity_type = 'tripletex_credentials' AND entity_id = $1`,
    [providerId],
  );
  await fixturePgQuery(
    `DELETE FROM public.provider_tripletex_credentials WHERE provider_id = $1`,
    [providerId],
  );
}

describe.skipIf(!hasDb)("loadProviderCredentials (TPT-B-1)", () => {
  let fx: ProviderTestFixtures;
  const fetchMock = vi.fn();

  beforeAll(async () => {
    fx = await buildProviderTestFixtures({
      includeEmployee: false,
      includeRegistrations: false,
      requireOrder: false,
    });

    const admin = serviceRoleClient();
    await (admin as any).rpc("lp_pgrst_reload_schema");
  }, 120_000);

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  afterAll(async () => {
    await cleanupCredentials(fx.providerA);
    if (fx?.cleanup) await fx.cleanup();
    await closeFixturePgPool();
  }, 120_000);

  test("happy path: set creds via RPC, load via resolveTripletexAuth, last_used_at updated", async () => {
    __clearTripletexSessionCacheForTests();

    await cleanupCredentials(fx.providerA);

    const sbAdmin = authenticatedClient(fx.superadmin.accessToken);
    const { data: setData, error: setError } = await (sbAdmin as any).rpc(
      "lp_provider_set_tripletex_credentials",
      {
        p_provider_id: fx.providerA,
        p_env: "test",
        p_consumer_token: CONSUMER,
        p_employee_token: EMPLOYEE,
        p_company_id_external: COMPANY_ID,
      },
    );

    expect(setError).toBeNull();
    expect(setData?.ok).toBe(true);
    expect(setData?.is_configured).toBe(true);

    const nativeFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal("fetch", ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("tripletex.no") || url.includes("api.tripletex")) {
        return fetchMock(input, init);
      }
      return nativeFetch(input, init);
    }) as typeof fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ value: { token: "provider-session-token-b1" } }), {
        status: 200,
      }),
    );

    const auth = await resolveTripletexAuth({ providerId: fx.providerA, env: "test" });
    expect(auth).toEqual({ companyId: String(COMPANY_ID), token: "provider-session-token-b1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const row = await fixturePgQuery<{ last_used_at: string | null }>(
      `SELECT last_used_at FROM public.provider_tripletex_credentials WHERE provider_id = $1`,
      [fx.providerA],
    );
    expect(row.rows[0]?.last_used_at).toBeTruthy();
  });

  test("not configured: missing creds → PROVIDER_CREDENTIALS_NOT_CONFIGURED", async () => {
    __clearTripletexSessionCacheForTests();
    const missingId = crypto.randomUUID();

    await expect(resolveTripletexAuth({ providerId: missingId, env: "test" })).rejects.toMatchObject({
      kind: "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
      code: "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
    });
  });

  test("encryption roundtrip: vault secret is not plaintext; load returns original tokens", async () => {
    await cleanupCredentials(fx.providerA);

    const sbAdmin = authenticatedClient(fx.superadmin.accessToken);
    await (sbAdmin as any).rpc("lp_provider_set_tripletex_credentials", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_consumer_token: CONSUMER,
      p_employee_token: EMPLOYEE,
      p_company_id_external: COMPANY_ID,
    });

    const credRow = await fixturePgQuery<{
      consumer_token_secret_id: string;
      employee_token_secret_id: string;
    }>(
      `SELECT consumer_token_secret_id, employee_token_secret_id
       FROM public.provider_tripletex_credentials WHERE provider_id = $1`,
      [fx.providerA],
    );
    const secretId = credRow.rows[0]?.consumer_token_secret_id;
    expect(secretId).toBeTruthy();

    const vaultRow = await fixturePgQuery<{ secret: string }>(
      `SELECT secret FROM vault.secrets WHERE id = $1`,
      [secretId],
    );
    expect(vaultRow.rows[0]?.secret).toBeTruthy();
    expect(vaultRow.rows[0]?.secret).not.toBe(CONSUMER);

    const admin = serviceRoleClient();
    const { data, error } = await (admin as any).rpc("lp_provider_load_tripletex_credentials", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).toBeNull();
    expect(data?.consumer_token).toBe(CONSUMER);
    expect(data?.employee_token).toBe(EMPLOYEE);
  });

  test("audit log: each load is logged with entity_type tripletex_credentials", async () => {
    await cleanupCredentials(fx.providerA);

    const sbAdmin = authenticatedClient(fx.superadmin.accessToken);
    await (sbAdmin as any).rpc("lp_provider_set_tripletex_credentials", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_consumer_token: CONSUMER,
      p_employee_token: EMPLOYEE,
      p_company_id_external: COMPANY_ID,
    });

    await fixturePgQuery(
      `DELETE FROM public.lifecycle_audit_log
       WHERE entity_type = 'tripletex_credentials' AND entity_id = $1`,
      [fx.providerA],
    );

    const admin = serviceRoleClient();
    const { error } = await (admin as any).rpc("lp_provider_load_tripletex_credentials", {
      p_provider_id: fx.providerA,
      p_env: "test",
    });
    expect(error).toBeNull();

    const audit = await fixturePgQuery<{ action: string; entity_type: string }>(
      `SELECT action, entity_type FROM public.lifecycle_audit_log
       WHERE entity_id = $1 AND entity_type = 'tripletex_credentials'
       ORDER BY created_at DESC LIMIT 1`,
      [fx.providerA],
    );
    expect(audit.rows[0]?.action).toBe("tripletex_credentials_loaded");
    expect(audit.rows[0]?.entity_type).toBe("tripletex_credentials");
  });

  test("RLS: provider_admin sees status RPC only; load RPC denied for authenticated", async () => {
    await cleanupCredentials(fx.providerA);

    const sbSuper = authenticatedClient(fx.superadmin.accessToken);
    await (sbSuper as any).rpc("lp_provider_set_tripletex_credentials", {
      p_provider_id: fx.providerA,
      p_env: "test",
      p_consumer_token: CONSUMER,
      p_employee_token: EMPLOYEE,
      p_company_id_external: COMPANY_ID,
    });

    const sbProvider = authenticatedClient(fx.providerAdminA.accessToken);
    const { data: status, error: statusError } = await (sbProvider as any).rpc(
      "lp_provider_get_tripletex_credentials_status",
      { p_provider_id: fx.providerA },
    );
    expect(statusError).toBeNull();
    expect(status?.is_configured).toBe(true);
    expect(status?.env).toBe("test");
    expect(status?.consumer_token).toBeUndefined();
    expect(status?.employee_token).toBeUndefined();

    const { data: directRows, error: directError } = await (sbProvider as any)
      .from("provider_tripletex_credentials")
      .select("id")
      .eq("provider_id", fx.providerA);
    expect(directError).toBeNull();
    expect(directRows ?? []).toHaveLength(0);

    const { error: loadError } = await (sbProvider as any).rpc(
      "lp_provider_load_tripletex_credentials",
      { p_provider_id: fx.providerA, p_env: "test" },
    );
    expect(loadError).toBeTruthy();
  });
});

describe("loadProviderCredentials unit guards (TPT-B-1)", () => {
  test("TripletexClientError shape for not-configured", () => {
    const err = new TripletexClientError({
      message: "Provider Tripletex credentials not configured. providerId=x, env=test",
      kind: "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
      code: "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
      detail: { providerId: "x", env: "test" },
    });
    expect(err.kind).toBe("PROVIDER_CREDENTIALS_NOT_CONFIGURED");
    expect(err.code).toBe("PROVIDER_CREDENTIALS_NOT_CONFIGURED");
  });
});
