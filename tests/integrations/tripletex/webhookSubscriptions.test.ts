import { beforeEach, describe, expect, test, vi } from "vitest";

const mockRequestTripletex = vi.hoisted(() => vi.fn());
const mockResolveTripletexAuth = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      upsert: mockUpsert,
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/integrations/tripletex/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/tripletex/client")>(
    "@/lib/integrations/tripletex/client",
  );
  return {
    ...actual,
    requestTripletex: mockRequestTripletex,
    resolveTripletexAuth: mockResolveTripletexAuth,
  };
});

import {
  buildTripletexWebhookSubscriptionBody,
  createWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookSubscriptions,
  syncWebhookSubscriptions,
} from "@/lib/integrations/tripletex/webhookSubscriptions";
import { TRIPLETEX_WEBHOOK_AUTH_HEADER } from "@/lib/integrations/tripletex/verifyTripletexWebhookSignature";

describe("Tripletex webhook subscriptions (polish-9)", () => {
  const providerId = "742c7d6c-3632-4362-a665-da0e415aab8c";
  const env = "test" as const;
  const auth = { companyId: "93310337", token: "session_xyz" };
  const targetUrl = "https://staging.app.lunchportalen.no/api/webhooks/tripletex-provider/x?env=test";
  const secret = "whsec_test_secret_value_32chars_min";

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTripletexAuth.mockResolvedValue(auth);
    mockUpsert.mockResolvedValue({ error: null });
  });

  test("buildTripletexWebhookSubscriptionBody bruker korrekt payload-shape", () => {
    const body = buildTripletexWebhookSubscriptionBody({
      eventType: "invoice.charged",
      targetUrl,
      secret,
    });

    expect(body).toEqual({
      event: "invoice.charged",
      targetUrl,
      authHeaderName: TRIPLETEX_WEBHOOK_AUTH_HEADER,
      authHeaderValue: secret,
    });
  });

  test("listWebhookSubscriptions returnerer rader fra Tripletex", async () => {
    mockRequestTripletex.mockResolvedValue({
      status: 200,
      raw: {},
      value: {
        values: [{ id: 23070, event: "invoice.charged", targetUrl }],
      },
    });

    const rows = await listWebhookSubscriptions({ providerId, env, request: { auth } });
    expect(rows).toHaveLength(1);
    expect(mockRequestTripletex).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/event/subscription" }),
      expect.objectContaining({ auth }),
    );
  });

  test("createWebhookSubscription POST med nested respons-id", async () => {
    mockRequestTripletex.mockResolvedValue({
      status: 200,
      raw: { value: { id: 23071 } },
      value: { id: 23071 },
    });

    const res = await createWebhookSubscription({
      providerId,
      env,
      eventType: "closegroup.create",
      targetUrl,
      secret,
      request: { auth },
    });

    expect(res.subscriptionId).toBe("23071");
    expect(mockRequestTripletex).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/event/subscription",
        body: buildTripletexWebhookSubscriptionBody({
          eventType: "closegroup.create",
          targetUrl,
          secret,
        }),
      }),
      expect.anything(),
    );
  });

  test("deleteWebhookSubscription kaller DELETE /event/subscription/{id}", async () => {
    mockRequestTripletex.mockResolvedValue({ status: 204, raw: null, value: null });

    await deleteWebhookSubscription({
      providerId,
      env,
      subscriptionId: "23072",
      request: { auth },
    });

    expect(mockRequestTripletex).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        path: "/event/subscription/23072",
      }),
      expect.anything(),
    );
  });

  test("syncWebhookSubscriptions — eksisterende match → no-op create, persist DB", async () => {
    mockRequestTripletex.mockResolvedValue({
      status: 200,
      raw: {},
      value: {
        values: [
          {
            id: 23070,
            event: "invoice.charged",
            targetUrl,
            authHeaderName: TRIPLETEX_WEBHOOK_AUTH_HEADER,
            authHeaderValue: secret,
          },
        ],
      },
    });

    const result = await syncWebhookSubscriptions({
      providerId,
      env,
      secret,
      targetUrl,
      desiredEvents: ["invoice.charged"],
    });

    expect(result.subscriptions).toEqual([{ eventType: "invoice.charged", subscriptionId: "23070" }]);
    expect(mockRequestTripletex).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  test("syncWebhookSubscriptions — feil config → delete + create", async () => {
    mockRequestTripletex
      .mockResolvedValueOnce({
        status: 200,
        raw: {},
        value: {
          values: [
            {
              id: 23070,
              event: "invoice.charged",
              targetUrl: "https://old.example/webhook",
              authHeaderName: TRIPLETEX_WEBHOOK_AUTH_HEADER,
              authHeaderValue: "old-secret",
            },
          ],
        },
      })
      .mockResolvedValueOnce({ status: 204, raw: null, value: null })
      .mockResolvedValueOnce({
        status: 200,
        raw: {},
        value: { id: 23080 },
      });

    const result = await syncWebhookSubscriptions({
      providerId,
      env,
      secret,
      targetUrl,
      desiredEvents: ["invoice.charged"],
    });

    expect(result.subscriptions[0]?.subscriptionId).toBe("23080");
    expect(mockRequestTripletex).toHaveBeenCalledTimes(3);
  });
});
