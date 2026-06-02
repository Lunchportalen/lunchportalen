/**
 * Patch 7 — lifecycle suspend/pause/delete RPCs (integration, opt-in).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { closeFixturePgPool, fixturePgQuery } from "@/tests/_helpers/fixturePg";
import { DEFAULT_PROVIDER_ID } from "@/tests/_helpers/rlsFixtures";
import {
  buildProviderTestFixtures,
  type ProviderTestFixtures,
} from "@/tests/_helpers/providerTestFixtures";
import { hasRemoteSupabaseIntegrationEnv } from "@/tests/_helpers/remoteSupabaseIntegration";
import { authenticatedClient } from "@/tests/_helpers/supabaseTestClient";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });
const REASON_OK = "Integrasjonstest Patch7 — tilstrekkelig lang begrunnelse.";
const REASON_SHORT = "for kort";

const COMPANY_LIFECYCLE_RPCS = [
  {
    name: "lp_company_suspend",
    args: (companyId: string) => ({ p_company_id: companyId, p_reason: REASON_OK }),
  },
  {
    name: "lp_company_pause",
    args: (companyId: string) => ({ p_company_id: companyId, p_reason: REASON_OK }),
  },
  {
    name: "lp_company_delete",
    args: (companyId: string) => ({ p_company_id: companyId, p_reason: REASON_OK }),
  },
  {
    name: "lp_company_resume",
    args: (companyId: string) => ({ p_company_id: companyId }),
  },
] as const;

describe.skipIf(!hasDb)("suspend RPC (Patch 7)", () => {
  let fx: ProviderTestFixtures;

  beforeAll(async () => {
    fx = await buildProviderTestFixtures({
      includeEmployee: true,
      includeRegistrations: false,
      includeProviderNonAdminRoles: true,
      orderOwner: "employeeA",
      requireOrder: true,
    });
  }, 180_000);

  afterAll(async () => {
    if (fx?.cleanup) await fx.cleanup();
    await closeFixturePgPool();
  }, 180_000);

  test("reason shorter than 20 chars returns error", async () => {
    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_SHORT,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/REASON_REQUIRED|20/i);
  });

  test("provider B admin cannot suspend company A", async () => {
    const sb = authenticatedClient(fx.providerAdminB.accessToken);
    const { error } = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_OK,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED/i);
  });

  test("company suspend pauses active orders and writes audit", async () => {
    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { data, error } = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_OK,
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    expect(Number(data?.cascade_orders_paused ?? 0)).toBeGreaterThanOrEqual(1);

    const ord = await fixturePgQuery<{ status: string }>(
      `SELECT status FROM public.orders WHERE id = $1`,
      [fx.orderA!],
    );
    expect(String(ord.rows[0]?.status ?? "").toUpperCase()).toBe("PAUSED");

    const audit = await fixturePgQuery<{ metadata: { cascade_orders_paused?: number } }>(
      `SELECT metadata FROM public.lifecycle_audit_log
       WHERE entity_id = $1 AND action = 'suspend'
       ORDER BY created_at DESC LIMIT 1`,
      [fx.companyA],
    );
    expect(audit.rows.length).toBe(1);
    expect(Number(audit.rows[0]?.metadata?.cascade_orders_paused ?? 0)).toBeGreaterThanOrEqual(1);

    const again = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_OK,
    });
    expect(again.error).toBeNull();
    expect(again.data?.already_suspended).toBe(true);

    await (sb as any).rpc("lp_company_resume", { p_company_id: fx.companyA });
  });

  test("employee cannot suspend company", async () => {
    const sb = authenticatedClient(fx.employeeA.accessToken);
    const { error } = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_OK,
    });
    expect(error).not.toBeNull();
  });

  test("superadmin can suspend provider (Melhus smoke)", async () => {
    const sb = authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await (sb as any).rpc("lp_provider_suspend", {
      p_provider_id: DEFAULT_PROVIDER_ID,
      p_reason: REASON_OK,
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    await (sb as any).rpc("lp_provider_resume", { p_provider_id: DEFAULT_PROVIDER_ID });
  });

  test("superadmin can suspend company via strict provider gate", async () => {
    const sb = authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await (sb as any).rpc("lp_company_suspend", {
      p_company_id: fx.companyA,
      p_reason: REASON_OK,
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    await (sb as any).rpc("lp_company_resume", { p_company_id: fx.companyA });
  });

  describe("non-admin provider roles blocked on company lifecycle RPCs", () => {
    const nonAdminCases = [
      { label: "provider_kitchen", token: () => fx.providerKitchenA!.accessToken },
      { label: "provider_viewer", token: () => fx.providerViewerA!.accessToken },
    ] as const;

    for (const { label, token } of nonAdminCases) {
      for (const { name, args } of COMPANY_LIFECYCLE_RPCS) {
        test(`${label} cannot call ${name}`, async () => {
          const sb = authenticatedClient(token());
          const { error } = await (sb as any).rpc(name, args(fx.companyA));
          expect(error).not.toBeNull();
          expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED/i);
          expect(String(error?.code ?? "")).toMatch(/42501|PGRST/i);
        });
      }
    }
  });
});
