/**
 * TPT-B-6 — POST /api/webhooks/tripletex-provider/[providerId]
 */

// @ts-nocheck

import { createHmac } from "node:crypto";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import { TRIPLETEX_WEBHOOK_HMAC_HEADER } from "@/lib/integrations/tripletex/verifyTripletexWebhookSignature";

const PROVIDER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const WEBHOOK_SECRET = "provider-webhook-secret-32bytes!!";

function hmacHex(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function mkReq(body: object, opts?: { secret?: string; omitSig?: boolean; providerId?: string }) {
  const secret = opts?.secret ?? WEBHOOK_SECRET;
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!opts?.omitSig) {
    headers[TRIPLETEX_WEBHOOK_HMAC_HEADER] = hmacHex(raw, secret);
  }
  const pid = opts?.providerId ?? PROVIDER_ID;
  return new Request(`http://localhost/api/webhooks/tripletex-provider/${pid}?env=prod`, {
    method: "POST",
    headers,
    body: raw,
  });
}

const webhookEvents: Array<Record<string, unknown>> = [];
const agreementInvoices: Array<Record<string, unknown>> = [];
const auditRows: Array<Record<string, unknown>> = [];

const rpcMock = vi.hoisted(() => vi.fn());
const getPaymentStatusMock = vi.hoisted(() => vi.fn());
const resolveAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integrations/tripletex/client", () => ({
  resolveTripletexAuth: (...args: unknown[]) => resolveAuthMock(...args),
  getTripletexInvoicePaymentStatus: (...args: unknown[]) => getPaymentStatusMock(...args),
  TripletexClientError: class TripletexClientError extends Error {
    kind: string;
    status: number | null;
    code: string;
    constructor(input: { message: string; kind: string; code: string; status?: number }) {
      super(input.message);
      this.name = "TripletexClientError";
      this.kind = input.kind;
      this.status = input.status ?? null;
      this.code = input.code;
    }
  },
}));

const fromMock = vi.hoisted(() =>
  vi.fn((table: string) => {
    if (table === "tripletex_webhook_events") {
      return {
        select: () => ({
          eq: (col: string, val: string) => ({
            eq: (col2: string, val2: string) => ({
              eq: (col3: string, val3: string) => ({
                maybeSingle: async () => {
                  const row = webhookEvents.find(
                    (r) =>
                      r.provider_id === val &&
                      r.env === val2 &&
                      r.tripletex_event_id === val3,
                  );
                  return { data: row ?? null, error: null };
                },
              }),
            }),
          }),
        }),
        insert: async (row: Record<string, unknown>) => {
          const dup = webhookEvents.some(
            (r) =>
              r.provider_id === row.provider_id &&
              r.env === row.env &&
              r.tripletex_event_id === row.tripletex_event_id,
          );
          if (dup) return { error: { code: "23505", message: "duplicate" } };
          webhookEvents.push({ ...row });
          return { error: null };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            eq: () => ({
              eq: async () => {
                const row = webhookEvents[webhookEvents.length - 1];
                if (row) Object.assign(row, patch);
                return { error: null };
              },
            }),
          }),
        }),
      };
    }
    if (table === "providers") {
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({
                data: { id: PROVIDER_ID },
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === "lifecycle_audit_log") {
      return {
        insert: async (row: Record<string, unknown>) => {
          auditRows.push(row);
          return { error: null };
        },
      };
    }
    throw new Error(`unexpected table ${table}`);
  }),
);

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: fromMock,
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

import { POST as ProviderWebhookPOST } from "../../app/api/webhooks/tripletex-provider/[providerId]/route";

beforeEach(() => {
  vi.clearAllMocks();
  webhookEvents.length = 0;
  agreementInvoices.length = 0;
  auditRows.length = 0;

  rpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "lp_provider_load_webhook_secret") {
      return { data: { webhook_secret: WEBHOOK_SECRET }, error: null };
    }
    if (name === "lp_apply_tripletex_paid_status") {
      const inv = agreementInvoices.find(
        (r) =>
          r.provider_id === args.p_provider_id &&
          r.tripletex_invoice_id === args.p_tripletex_invoice_id,
      );
      if (!inv) {
        return {
          data: { ok: true, updated: false, reason: "NOT_FOUND" },
          error: null,
        };
      }
      if (inv.status === "PAID") {
        return {
          data: {
            ok: true,
            updated: false,
            previous_status: "PAID",
            invoice_id: inv.id,
            reason: "ALREADY_PAID",
          },
          error: null,
        };
      }
      if (inv.status !== "SENT") {
        return {
          data: {
            ok: true,
            updated: false,
            previous_status: inv.status,
            invoice_id: inv.id,
            reason: "INVALID_TRANSITION",
          },
          error: null,
        };
      }
      inv.status = "PAID";
      inv.paid_at = new Date().toISOString();
      return {
        data: {
          ok: true,
          updated: true,
          previous_status: "SENT",
          invoice_id: inv.id,
        },
        error: null,
      };
    }
    return { data: null, error: { message: `unknown rpc ${name}` } };
  });

  resolveAuthMock.mockResolvedValue({ companyId: "1", token: "tok" });
  getPaymentStatusMock.mockResolvedValue({
    tripletexId: "9001",
    isPaid: true,
    amountOutstanding: 0,
    source: "invoice",
    raw: {},
  });

  agreementInvoices.push({
    id: "agr-inv-1",
    provider_id: PROVIDER_ID,
    status: "SENT",
    tripletex_invoice_id: "9001",
  });
});

describe("Provider Tripletex webhook — security", () => {
  test("missing signature → 401", async () => {
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 1, event: "invoice.paid", id: 9001 }, { omitSig: true }),
      { params: { providerId: PROVIDER_ID } },
    );
    expect(res.status).toBe(401);
    expect(webhookEvents.length).toBe(0);
    expect(auditRows.some((r) => r.action === "tripletex_provider_webhook_signature_rejected")).toBe(
      true,
    );
  });

  test("invalid signature → 401", async () => {
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 1, event: "invoice.paid", id: 9001 }, { secret: "wrong" }),
      { params: { providerId: PROVIDER_ID } },
    );
    expect(res.status).toBe(401);
    expect(webhookEvents.length).toBe(0);
  });

  test("unknown provider id format → 401", async () => {
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 1, event: "invoice.paid", id: 9001 }, { providerId: "not-a-uuid" }),
      { params: { providerId: "not-a-uuid" } },
    );
    expect(res.status).toBe(401);
  });
});

describe("Provider Tripletex webhook — happy path", () => {
  test("invoice.paid + re-verify → PAID", async () => {
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 10, event: "invoice.paid", id: 9001 }),
      { params: { providerId: PROVIDER_ID } },
    );
    expect(res.status).toBe(200);
    expect(agreementInvoices[0].status).toBe("PAID");
    expect(getPaymentStatusMock).toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith("lp_apply_tripletex_paid_status", {
      p_provider_id: PROVIDER_ID,
      p_tripletex_invoice_id: "9001",
    });
    const row = webhookEvents.find(
      (r) => r.tripletex_event_id === `tripletex:provider:${PROVIDER_ID}:prod:10:invoice.paid:9001`,
    );
    expect(row?.status).toBe("PROCESSED");
  });
});

describe("Provider Tripletex webhook — idempotency", () => {
  test("duplicate event_id → 200 noop", async () => {
    webhookEvents.push({
      provider_id: PROVIDER_ID,
      env: "prod",
      tripletex_event_id: `tripletex:provider:${PROVIDER_ID}:prod:10:invoice.paid:9001`,
      status: "PROCESSED",
    });
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 10, event: "invoice.paid", id: 9001 }),
      { params: { providerId: PROVIDER_ID } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.duplicate).toBe(true);
    expect(agreementInvoices[0].status).toBe("SENT");
  });
});

describe("Provider Tripletex webhook — event handling", () => {
  test("unknown event_type → 200 ignored", async () => {
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 3, event: "product.create", id: 42 }),
      { params: { providerId: PROVIDER_ID } },
    );
    expect(res.status).toBe(200);
    const row = webhookEvents.find(
      (r) => r.tripletex_event_id === `tripletex:provider:${PROVIDER_ID}:prod:3:product.create:42`,
    );
    expect(row?.status).toBe("IGNORED");
    expect(getPaymentStatusMock).not.toHaveBeenCalled();
  });

  test("re-verify unpaid → 200 ignored", async () => {
    getPaymentStatusMock.mockResolvedValueOnce({
      tripletexId: "9001",
      isPaid: false,
      amountOutstanding: 100,
      source: "invoice",
      raw: {},
    });
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 4, event: "invoice.paid", id: 9001 }),
      { params: { providerId: PROVIDER_ID } },
    );
    expect(res.status).toBe(200);
    expect(agreementInvoices[0].status).toBe("SENT");
    const row = webhookEvents.find(
      (r) => r.tripletex_event_id === `tripletex:provider:${PROVIDER_ID}:prod:4:invoice.paid:9001`,
    );
    expect(row?.status).toBe("IGNORED");
  });

  test("DRAFT invoice → 200 invalid transition noop", async () => {
    agreementInvoices[0].status = "DRAFT";
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 5, event: "invoice.paid", id: 9001 }),
      { params: { providerId: PROVIDER_ID } },
    );
    expect(res.status).toBe(200);
    expect(agreementInvoices[0].status).toBe("DRAFT");
  });

  test("already PAID → 200 noop", async () => {
    agreementInvoices[0].status = "PAID";
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 6, event: "invoice.paid", id: 9001 }),
      { params: { providerId: PROVIDER_ID } },
    );
    expect(res.status).toBe(200);
    expect(agreementInvoices[0].status).toBe("PAID");
  });

  test("unknown tripletex invoice → 200 ignored", async () => {
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 7, event: "invoice.paid", id: 99999 }),
      { params: { providerId: PROVIDER_ID } },
    );
    expect(res.status).toBe(200);
  });

  test("Tripletex GET 5xx → 200 pending", async () => {
    const { TripletexClientError } = await import("@/lib/integrations/tripletex/client");
    getPaymentStatusMock.mockRejectedValueOnce(
      new TripletexClientError({
        message: "down",
        kind: "TRANSIENT",
        code: "TRIPLETEX_DOWN",
        status: 503,
      }),
    );
    const res = await ProviderWebhookPOST(
      mkReq({ subscriptionId: 8, event: "invoice.paid", id: 9001 }),
      { params: { providerId: PROVIDER_ID } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.pending).toBe(true);
    const row = webhookEvents.find(
      (r) => r.tripletex_event_id === `tripletex:provider:${PROVIDER_ID}:prod:8:invoice.paid:9001`,
    );
    expect(row?.status).toBe("PENDING");
  });
});
