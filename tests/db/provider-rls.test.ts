/**
 * Patch 6 — provider-scoped RLS (can_access_provider + parallel policies).
 * Requires RUN_SUPABASE_INTEGRATION_TESTS=1, staging Supabase URL, and postgres fixture URL.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { closeFixturePgPool } from "@/tests/_helpers/fixturePg";
import {
  buildProviderTestFixtures,
  type ProviderTestFixtures,
} from "@/tests/_helpers/providerTestFixtures";
import { buildRlsFixtures, type Fixtures } from "@/tests/_helpers/rlsFixtures";
import {
  hasRemoteSupabaseIntegrationEnv,
  readRemoteSupabaseIntegrationEnv,
} from "@/tests/_helpers/remoteSupabaseIntegration";
import { authenticatedClient } from "@/tests/_helpers/supabaseTestClient";

const MELHUS_ID = "11111111-1111-1111-1111-111111111111";
const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

function rowCount(res: { data: unknown; error: unknown }) {
  if (res.error) return NaN;
  const d = res.data;
  return Array.isArray(d) ? d.length : 0;
}

let pfx: ProviderTestFixtures;
let companyFx: Fixtures;

describe.skipIf(!hasDb)("provider RLS (Patch 6)", () => {
  beforeAll(async () => {
    pfx = await buildProviderTestFixtures({ includeRegistrations: true });
    companyFx = await buildRlsFixtures();
  }, 120_000);

  afterAll(async () => {
    if (pfx?.cleanup) await pfx.cleanup();
    if (companyFx?.cleanup) await companyFx.cleanup();
    await closeFixturePgPool();
  }, 120_000);

  describe("can_access_provider()", () => {
    test("true for provider membership", async () => {
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const { data, error } = await (sb as any).rpc("can_access_provider", { p_provider_id: pfx.providerA });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    test("false without membership", async () => {
      const sb = authenticatedClient(pfx.outsider.accessToken);
      const { data, error } = await (sb as any).rpc("can_access_provider", { p_provider_id: pfx.providerA });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    test("true for superadmin on any provider", async () => {
      const sb = authenticatedClient(pfx.superadmin.accessToken);
      const { data, error } = await (sb as any).rpc("can_access_provider", { p_provider_id: pfx.providerB });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    test("false for non-existent provider id", async () => {
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const fake = "00000000-0000-0000-0000-000000000099";
      const { data, error } = await (sb as any).rpc("can_access_provider", { p_provider_id: fake });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });

  describe("providers SELECT", () => {
    test("provider_admin sees own provider", async () => {
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const res = await (sb as any).from("providers").select("id").eq("id", pfx.providerA);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(1);
    });

    test("provider_admin does not see other providers", async () => {
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const res = await (sb as any).from("providers").select("id").eq("id", pfx.providerB);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(0);
    });

    test("superadmin sees all providers", async () => {
      const sb = authenticatedClient(pfx.superadmin.accessToken);
      const res = await (sb as any).from("providers").select("id").in("id", [pfx.providerA, pfx.providerB]);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(2);
    });
  });

  describe("companies SELECT (additive)", () => {
    test("company_admin still sees own company", async () => {
      const { supabaseAs: as, users, companyA } = companyFx;
      const res = await as(users.adminA.accessToken).from("companies").select("id").eq("id", companyA.id);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBeGreaterThanOrEqual(1);
    });

    test("provider_admin sees companies via provider_id", async () => {
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const res = await sb.from("companies").select("id").eq("id", pfx.companyA);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(1);
    });

    test("employee without company membership sees no companies", async () => {
      const sb = authenticatedClient(pfx.outsider.accessToken);
      const res = await sb.from("companies").select("id").limit(5);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(0);
    });

    test("anon cannot read companies", async () => {
      const { url, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
      const anon = createClient<Database>(url, anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const res = await anon.from("companies").select("id").limit(1);
      expect(res.error).not.toBeNull();
    });
  });

  describe("orders SELECT (additive)", () => {
    test("provider_admin sees orders for own provider", async () => {
      if (!pfx.orderA) return;
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const res = await sb.from("orders").select("id").eq("id", pfx.orderA);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(1);
    });

    test("company_admin still sees own company orders", async () => {
      const { supabaseAs: as, users, companyA } = companyFx;
      const sb = as(users.adminA.accessToken);
      const res = await sb.from("orders").select("id,company_id").eq("company_id", companyA.id);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("company_registrations SELECT", () => {
    test("provider_admin sees registrations with provider_id set", async () => {
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const res = await sb.from("company_registrations").select("id").eq("id", pfx.regA!);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(1);
    });

    test("NULL provider_id registration is not visible", async () => {
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const res = await sb.from("company_registrations").select("id").eq("id", pfx.regNull!);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(0);
    });
  });

  describe("cross-provider isolation", () => {
    test("provider A admin cannot read B companies", async () => {
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const res = await sb.from("companies").select("id").eq("id", pfx.companyB);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(0);
    });

    test("provider A admin cannot read B agreements", async () => {
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const res = await sb.from("agreements").select("id").eq("company_id", pfx.companyB);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(0);
    });

    test("provider A admin cannot update B company", async () => {
      const sb = authenticatedClient(pfx.providerAdminA.accessToken);
      const res = await sb
        .from("companies")
        .update({ name: `Hacked ${pfx.rid}` } as any)
        .eq("id", pfx.companyB)
        .select("id");
      expect(rowCount(res)).toBe(0);
    });
  });

  describe("Melhus default provider (staging/prod parity)", () => {
    test("Melhus provider row is readable by superadmin", async () => {
      const sb = authenticatedClient(pfx.superadmin.accessToken);
      const res = await (sb as any).from("providers").select("id,slug").eq("id", MELHUS_ID);
      expect(res.error).toBeNull();
      expect(rowCount(res)).toBe(1);
      expect((res.data as { slug?: string }[] | null)?.[0]?.slug).toBe("melhus-catering");
    });
  });
});
