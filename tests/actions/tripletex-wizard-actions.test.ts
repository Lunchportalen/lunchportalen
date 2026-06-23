/**
 * TPT-B-7b — Tripletex wizard server actions (unit).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockVerify = vi.fn();
const mockTestAndRecord = vi.fn();
const mockCompleteAfterVerify = vi.fn();
const mockGetAuthContext = vi.fn();
const mockHasProviderRole = vi.fn();
const mockSupabaseServer = vi.fn();
const mockSupabaseAdmin = vi.fn();

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock("@/lib/auth/provider", () => ({
  hasProviderRole: (...args: unknown[]) => mockHasProviderRole(...args),
}));

vi.mock("@/lib/integrations/tripletex/onboardingVerify", () => ({
  verifyTripletexEmployeeToken: (...args: unknown[]) => mockVerify(...args),
  testAndRecordTripletexToken: (...args: unknown[]) => mockTestAndRecord(...args),
  completeTripletexConnectionAfterVerify: (...args: unknown[]) => mockCompleteAfterVerify(...args),
}));

vi.mock("@/lib/integrations/tripletex/webhookSubscriptions", () => ({
  syncWebhookSubscriptions: vi.fn().mockResolvedValue({
    subscriptions: [{ eventType: "invoice.charged", subscriptionId: "23070" }],
  }),
}));

vi.mock("@/lib/integrations/tripletex/providerWebhookUrl", () => ({
  buildProviderTripletexWebhookUrl: vi.fn().mockReturnValue("https://example.test/webhook"),
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
  completeConnectionAction,
  finalizeConnectionAction,
  getHealthAction,
  verifyTokenAction,
} from "@/app/leverandor/innstillinger/tripletex/koble-til/actions";

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

const OK_VERIFY = {
  auth: { ok: true, error: null, company_id: 114612665, company_name: "Test AS" },
  company_match: { ok: true, error: null, company_id: 114612665, company_name: "Test AS" },
  scope: { ok: true, error: null },
  all_passed: true,
};

function authOk() {
  mockGetAuthContext.mockResolvedValue({ ok: true, user: { id: USER_ID } });
  mockHasProviderRole.mockResolvedValue(true);
}

describe("tripletex wizard actions (TPT-B-7b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
    mockVerify.mockResolvedValue(OK_VERIFY);
    mockTestAndRecord.mockResolvedValue(OK_VERIFY);
    mockCompleteAfterVerify.mockResolvedValue({ connection_state: "CONFIGURING" });
  });

  test("verifyTokenAction happy", async () => {
    const res = await verifyTokenAction({
      providerId: PROVIDER_ID,
      tripletexCompanyId: "114612665",
      employeeToken: "secret-token",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.all_passed).toBe(true);
    expect(mockVerify).toHaveBeenCalled();
    expect(mockTestAndRecord).toHaveBeenCalled();
  });

  test("verifyTokenAction invalid token → auth.ok=false path", async () => {
    mockVerify.mockResolvedValue({
      ...OK_VERIFY,
      auth: { ok: false, error: "Token avvist" },
      all_passed: false,
    });
    const res = await verifyTokenAction({
      providerId: PROVIDER_ID,
      tripletexCompanyId: "114612665",
      employeeToken: "bad",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.all_passed).toBe(false);
  });

  test("verifyTokenAction without provider_admin → permission denied", async () => {
    mockHasProviderRole.mockResolvedValue(false);
    const res = await verifyTokenAction({
      providerId: PROVIDER_ID,
      tripletexCompanyId: "114612665",
      employeeToken: "secret",
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.code).toBe("FORBIDDEN");
      expect(res.errorKey).toBe("providerAdminRequired");
      expect(res).not.toHaveProperty("error");
    }
  });

  test("completeConnectionAction happy → CONFIGURING", async () => {
    const res = await completeConnectionAction({
      providerId: PROVIDER_ID,
      tripletexCompanyId: "114612665",
      employeeToken: "secret-token",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.connection_state).toBe("CONFIGURING");
    expect(mockCompleteAfterVerify).toHaveBeenCalled();
  });

  test("completeConnectionAction with failed re-verify", async () => {
    mockVerify.mockResolvedValue({
      ...OK_VERIFY,
      scope: { ok: false, error: "mangler scope" },
      all_passed: false,
    });
    const res = await completeConnectionAction({
      providerId: PROVIDER_ID,
      tripletexCompanyId: "114612665",
      employeeToken: "secret-token",
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.code).toBe("VERIFICATION_FAILED");
      expect(res.errorKey).toBe("verificationFailed");
    }
    expect(mockCompleteAfterVerify).not.toHaveBeenCalled();
  });

  test("finalizeConnectionAction happy → CONNECTED", async () => {
    mockSupabaseAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { webhook_secret: "whsec_test_secret_123456789012345678" },
        error: null,
      }),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockSupabaseServer.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: { connection_state: "CONNECTED", ready_for_billing: true },
        error: null,
      }),
    });

    const res = await finalizeConnectionAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.connection_state).toBe("CONNECTED");
  });

  test("finalizeConnectionAction without provisioning complete", async () => {
    mockSupabaseAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { webhook_secret: "whsec_test_secret_123456789012345678" },
        error: null,
      }),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockSupabaseServer.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "PROVISIONING_NOT_COMPLETE" },
      }),
    });

    const res = await finalizeConnectionAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.code).toBe("PROVISIONING_NOT_COMPLETE");
      expect(res.errorKey).toBe("provisioningNotComplete");
    }
  });

  test("getHealthAction returns expected shape", async () => {
    mockSupabaseServer.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: {
          state: "CONFIGURING",
          tripletex_company_name: "Test AS",
          stats_30d: { invoices_sent: 0 },
          recent_events: [{ action: "tripletex_onboarding_provisioning_completed", created_at: "2026-05-21" }],
        },
        error: null,
      }),
    });
    mockSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { onboarding_provisioning_complete_at: "2026-05-21T12:00:00Z" },
            }),
          }),
        }),
      }),
    });

    const res = await getHealthAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.state).toBe("CONFIGURING");
      expect(res.data.provisioningComplete).toBe(true);
      expect(res.data.tripletexCompanyName).toBe("Test AS");
    }
  });
});
