/**
 * TPT-B-7c — Tripletex status dashboard server actions (unit).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockGetAuthContext = vi.fn();
const mockCanAccessProvider = vi.fn();
const mockHasProviderRole = vi.fn();
const mockIsSuperadminProfile = vi.fn();
const mockVerify = vi.fn();
const mockTestAndRecord = vi.fn();
const mockSupabaseServer = vi.fn();
const mockSupabaseAdmin = vi.fn();
const mockWebhookSubsUpdate = vi.fn();

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock("@/lib/auth/provider", () => ({
  canAccessProvider: (...args: unknown[]) => mockCanAccessProvider(...args),
  hasProviderRole: (...args: unknown[]) => mockHasProviderRole(...args),
}));

vi.mock("@/lib/auth/isSuperadminProfile", () => ({
  isSuperadminProfile: (...args: unknown[]) => mockIsSuperadminProfile(...args),
}));

vi.mock("@/lib/integrations/tripletex/onboardingVerify", () => ({
  verifyTripletexEmployeeToken: (...args: unknown[]) => mockVerify(...args),
  testAndRecordTripletexToken: (...args: unknown[]) => mockTestAndRecord(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => mockSupabaseAdmin(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  disconnectTripletexAction,
  getDashboardDataAction,
  testConnectionAction,
} from "@/app/leverandor/innstillinger/tripletex/status/actions";

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

const OK_VERIFY = {
  auth: { ok: true, error: null, company_id: 114612665, company_name: "Test AS" },
  company_match: { ok: true, error: null, company_id: 114612665, company_name: "Test AS" },
  scope: { ok: true, error: null },
  all_passed: true,
};

function authViewerOk() {
  mockGetAuthContext.mockResolvedValue({ ok: true, user: { id: USER_ID } });
  mockCanAccessProvider.mockResolvedValue(true);
  mockHasProviderRole.mockResolvedValue(false);
  mockIsSuperadminProfile.mockResolvedValue(false);
}

function authAdminOk() {
  authViewerOk();
  mockHasProviderRole.mockResolvedValue(true);
}

function mockHealthRpc(state = "CONNECTED") {
  mockSupabaseServer.mockResolvedValue({
    rpc: vi.fn().mockResolvedValue({
      data: {
        state,
        state_since: "2026-05-21T10:00:00Z",
        tripletex_company_id: 114612665,
        tripletex_company_name: "Test AS",
        last_health_check: "2026-05-21T05:00:00Z",
        stats_30d: {
          invoices_sent: 2,
          invoices_paid: 1,
          worker_failures: 0,
          webhook_events: 3,
        },
        recent_events: [{ action: "tripletex_onboarding_finalized", created_at: "2026-05-21T12:00:00Z", metadata: {} }],
        warnings: [],
      },
      error: null,
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { last_rotated_at: "2026-05-20T08:00:00Z" }, error: null }),
          }),
        }),
      }),
    }),
  });
}

function mockAdminCounts() {
  mockWebhookSubsUpdate.mockReset();
  mockWebhookSubsUpdate.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  });

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };

  chain.maybeSingle
    .mockResolvedValueOnce({ data: { onboarding_provisioning_complete_at: "2026-05-21T11:00:00Z", vault_purge_at: null }, error: null })
    .mockResolvedValueOnce({ data: { received_at: "2026-05-21T13:00:00Z" }, error: null });

  mockSupabaseAdmin.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "provider_tripletex_credentials") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: chain.maybeSingle,
            }),
          }),
        };
      }
      if (table === "provider_tripletex_products") {
        return {
          select: vi.fn((cols: string, opts?: { head?: boolean }) => {
            if (opts?.head) {
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ count: 3, data: null, error: null }),
                }),
              };
            }
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ tripletex_vat_code: "3" }, { tripletex_vat_code: "31" }],
                  error: null,
                }),
              }),
            };
          }),
        };
      }
      if (table === "tripletex_customers") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 1, data: null, error: null }),
          }),
        };
      }
      if (table === "tripletex_webhook_events") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: chain.maybeSingle,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "provider_tripletex_webhook_subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
          update: mockWebhookSubsUpdate,
        };
      }
      return chain;
    }),
    rpc: vi.fn(),
  });
}

describe("tripletex status actions (TPT-B-7c)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authViewerOk();
    mockHealthRpc();
    mockAdminCounts();
    mockVerify.mockResolvedValue(OK_VERIFY);
    mockTestAndRecord.mockResolvedValue(OK_VERIFY);
  });

  test("getDashboardDataAction allows provider_viewer read", async () => {
    const res = await getDashboardDataAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.state).toBe("CONNECTED");
      expect(res.data.resourceCounts.products).toBe(3);
      expect(res.data.resourceCounts.customers).toBe(1);
      expect(res.data.resourceCounts.vatCodes).toBe(2);
      expect(res.data.webhook.url).toContain(PROVIDER_ID);
    }
  });

  test("getDashboardDataAction forbidden without membership", async () => {
    mockCanAccessProvider.mockResolvedValue(false);
    const res = await getDashboardDataAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("FORBIDDEN");
  });

  test("testConnectionAction requires provider_admin", async () => {
    const res = await testConnectionAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("FORBIDDEN");
  });

  test("testConnectionAction happy path for admin", async () => {
    authAdminOk();
    mockSupabaseAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { employee_token: "tok", company_id_external: 114612665 },
        error: null,
      }),
      from: vi.fn(),
    });

    const res = await testConnectionAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.all_passed).toBe(true);
    expect(mockVerify).toHaveBeenCalled();
    expect(mockTestAndRecord).toHaveBeenCalled();
  });

  test("disconnectTripletexAction happy path", async () => {
    authAdminOk();
    mockSupabaseServer.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: { connection_state: "DISCONNECTED", vault_purge_at: "2026-06-20T00:00:00Z", days_until_purge: 30 },
        error: null,
      }),
    });

    const res = await disconnectTripletexAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.connection_state).toBe("DISCONNECTED");
    expect(mockWebhookSubsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ active: false, updated_at: expect.any(String) }),
    );
  });

  test("CONFIGURING dashboard exposes webhook CTA inputs via provisioningComplete", async () => {
    mockHealthRpc("CONFIGURING");
    const res = await getDashboardDataAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.state).toBe("CONFIGURING");
      expect(res.data.provisioningComplete).toBe(true);
    }
  });
});
