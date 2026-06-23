/**
 * TPT-B-7 polish-9 — finalizeConnectionAction with auto webhook registration.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockSyncWebhookSubscriptions = vi.fn();
const mockGetAuthContext = vi.fn();
const mockHasProviderRole = vi.fn();
const mockSupabaseServer = vi.fn();
const mockSupabaseAdmin = vi.fn();
const mockBuildUrl = vi.fn();

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock("@/lib/auth/provider", () => ({
  hasProviderRole: (...args: unknown[]) => mockHasProviderRole(...args),
}));

vi.mock("@/lib/integrations/tripletex/webhookSubscriptions", () => ({
  syncWebhookSubscriptions: (...args: unknown[]) => mockSyncWebhookSubscriptions(...args),
}));

vi.mock("@/lib/integrations/tripletex/providerWebhookUrl", () => ({
  buildProviderTripletexWebhookUrl: (...args: unknown[]) => mockBuildUrl(...args),
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

import { finalizeConnectionAction } from "@/app/leverandor/innstillinger/tripletex/koble-til/actions";

const PROVIDER_ID = "742c7d6c-3632-4362-a665-da0e415aab8c";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const WEBHOOK_URL = `https://staging.app.lunchportalen.no/api/webhooks/tripletex-provider/${PROVIDER_ID}?env=test`;

function authOk() {
  mockGetAuthContext.mockResolvedValue({ ok: true, user: { id: USER_ID } });
  mockHasProviderRole.mockResolvedValue(true);
}

describe("finalizeConnectionAction with webhook sync (polish-9)", () => {
  const mockRpc = vi.fn();
  const mockAdminRpc = vi.fn();
  const mockAdminFrom = vi.fn();
  const mockAdminInsert = vi.fn();
  const mockAdminUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
    mockBuildUrl.mockReturnValue(WEBHOOK_URL);

    mockAdminInsert.mockResolvedValue({ error: null });
    mockAdminUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "lifecycle_audit_log") {
        return { insert: mockAdminInsert };
      }
      if (table === "provider_tripletex_credentials") {
        return { update: mockAdminUpdate };
      }
      throw new Error(`unexpected table ${table}`);
    });

    mockSupabaseAdmin.mockReturnValue({
      rpc: mockAdminRpc,
      from: mockAdminFrom,
    });

    mockAdminRpc.mockResolvedValue({
      data: { webhook_secret: "whsec_auto_register_test_secret_123456" },
      error: null,
    });

    mockSupabaseServer.mockResolvedValue({ rpc: mockRpc });
    mockRpc.mockResolvedValue({
      data: { connection_state: "CONNECTED", ready_for_billing: true },
      error: null,
    });
  });

  test("happy path: 3 subscriptions opprettet og audit logget", async () => {
    mockSyncWebhookSubscriptions.mockResolvedValue({
      subscriptions: [
        { eventType: "invoice.charged", subscriptionId: "23070" },
        { eventType: "closegroup.create", subscriptionId: "23071" },
        { eventType: "order.update", subscriptionId: "23072" },
      ],
    });

    const res = await finalizeConnectionAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.connection_state).toBe("CONNECTED");

    expect(mockSyncWebhookSubscriptions).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: PROVIDER_ID,
        targetUrl: WEBHOOK_URL,
        secret: "whsec_auto_register_test_secret_123456",
      }),
    );

    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tripletex_webhooks_registered",
        metadata: expect.objectContaining({
          subscription_ids: ["23070", "23071", "23072"],
          event_types: ["invoice.charged", "closegroup.create", "order.update"],
        }),
      }),
    );
    expect(mockRpc).toHaveBeenCalled();
  });

  test("partial failure: webhook sync feiler → rollback CONFIGURING", async () => {
    mockSyncWebhookSubscriptions.mockRejectedValue(new Error("Tripletex API unavailable"));

    const res = await finalizeConnectionAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.code).toBe("WEBHOOK_SYNC_FAILED");
      expect(res.errorKey).toBe("webhookSyncFailed");
      expect(res).not.toHaveProperty("error");
    }

    expect(mockAdminUpdate).toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test("idempotent re-finalize: sync kalles, finalize RPC idempotent", async () => {
    mockSyncWebhookSubscriptions.mockResolvedValue({
      subscriptions: [{ eventType: "invoice.charged", subscriptionId: "23070" }],
    });
    mockRpc.mockResolvedValue({
      data: { connection_state: "CONNECTED", idempotent: true },
      error: null,
    });

    const res = await finalizeConnectionAction({ providerId: PROVIDER_ID });
    expect(res.ok).toBe(true);
    expect(mockSyncWebhookSubscriptions).toHaveBeenCalledTimes(1);
  });
});
