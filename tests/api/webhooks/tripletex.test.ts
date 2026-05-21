/**
 * TPT-A-6 — POST /api/webhooks/tripletex
 */

// @ts-nocheck

import { createHmac } from "node:crypto";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import { TRIPLETEX_WEBHOOK_HMAC_HEADER } from "@/lib/integrations/tripletex/verifyTripletexWebhookSignature";

function hmacHex(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function mkReq(body: object, opts?: { secret?: string; omitSig?: boolean }) {
  const secret = opts?.secret ?? "test-webhook-secret";
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!opts?.omitSig) {
    headers[TRIPLETEX_WEBHOOK_HMAC_HEADER] = hmacHex(raw, secret);
  }
  return new Request("http://localhost/api/webhooks/tripletex", {
    method: "POST",
    headers,
    body: raw,
  });
}

const webhookEvents: Array<Record<string, unknown>> = [];
const providerInvoices: Array<Record<string, unknown>> = [];
const auditRows: Array<Record<string, unknown>> = [];

const fromMock = vi.hoisted(() =>
  vi.fn((table: string) => {
    if (table === "webhook_events") {
      return {
        select: () => ({
          eq: (_col: string, eventId: string) => ({
            maybeSingle: async () => {
              const row = webhookEvents.find((r) => r.event_id === eventId);
              return { data: row ?? null, error: null };
            },
          }),
        }),
        insert: async (row: Record<string, unknown>) => {
          if (webhookEvents.some((r) => r.event_id === row.event_id)) {
            return { error: { code: "23505", message: "duplicate" } };
          }
          webhookEvents.push({ ...row });
          return { error: null };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (_col: string, eventId: string) => {
            const row = webhookEvents.find((r) => r.event_id === eventId);
            if (row) Object.assign(row, patch);
            return { error: null };
          },
        }),
      };
    }
    if (table === "provider_invoices") {
      return {
        select: () => ({
          eq: (_col: string, tripletexId: string) => ({
            maybeSingle: async () => {
              const row = providerInvoices.find((r) => r.tripletex_invoice_id === tripletexId);
              return { data: row ?? null, error: null };
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (col: string, id: string) => ({
            in: async (statusCol: string, statuses: string[]) => {
              const row = providerInvoices.find((r) => r[col] === id && statuses.includes(r.status));
              if (row) Object.assign(row, patch);
              return { error: null };
            },
            neq: async (statusCol: string, status: string) => {
              const row = providerInvoices.find((r) => r[col] === id && r[statusCol] !== status);
              if (row) Object.assign(row, patch);
              return { error: null };
            },
            eq: async (statusCol: string, status: string) => {
              const row = providerInvoices.find((r) => r[col] === id && r[statusCol] === status);
              if (row) Object.assign(row, patch);
              return { error: null };
            },
          }),
        }),
      };
    }
    if (table === "tripletex_customers") {
      return {
        select: () => ({
          eq: () => ({
            limit: async () => ({ data: [], error: null }),
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
  supabaseAdmin: () => ({ from: fromMock }),
}));

import { POST as TripletexWebhookPOST } from "../../../app/api/webhooks/tripletex/route";

const origSecret = process.env.TRIPLETEX_WEBHOOK_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  webhookEvents.length = 0;
  providerInvoices.length = 0;
  auditRows.length = 0;
  process.env.TRIPLETEX_WEBHOOK_SECRET = "test-webhook-secret";
  providerInvoices.push({
    id: "inv-1",
    provider_id: "prov-1",
    status: "SENT",
    tripletex_invoice_id: "9001",
  });
});

afterEach(() => {
  if (origSecret !== undefined) process.env.TRIPLETEX_WEBHOOK_SECRET = origSecret;
  else delete process.env.TRIPLETEX_WEBHOOK_SECRET;
});

describe("Tripletex webhook — security", () => {
  test("missing signature → 401", async () => {
    const res = await TripletexWebhookPOST(
      mkReq({ subscriptionId: 1, event: "invoice.paid", id: 9001 }, { omitSig: true }),
    );
    expect(res.status).toBe(401);
    expect(webhookEvents.length).toBe(0);
    expect(auditRows.some((r) => r.action === "tripletex_webhook_signature_rejected")).toBe(true);
  });

  test("invalid signature → 401", async () => {
    const res = await TripletexWebhookPOST(
      mkReq({ subscriptionId: 1, event: "invoice.paid", id: 9001 }, { secret: "wrong-secret" }),
    );
    expect(res.status).toBe(401);
    expect(webhookEvents.length).toBe(0);
  });
});

describe("Tripletex webhook — happy path", () => {
  test("invoice.paid → PAID + PROCESSED + audit", async () => {
    const res = await TripletexWebhookPOST(
      mkReq({ subscriptionId: 10, event: "invoice.paid", id: 9001 }),
    );
    expect(res.status).toBe(200);
    expect(providerInvoices[0].status).toBe("PAID");
    expect(providerInvoices[0].paid_at).toBeTruthy();
    const row = webhookEvents.find((r) => r.event_id === "tripletex:10:invoice.paid:9001");
    expect(row?.status).toBe("PROCESSED");
    expect(auditRows.some((r) => r.action === "tripletex_webhook_received")).toBe(true);
    expect(auditRows.some((r) => r.action === "tripletex_webhook_invoice_paid")).toBe(true);
  });
});

describe("Tripletex webhook — idempotency", () => {
  test("duplicate event_id → 200, no double update", async () => {
    webhookEvents.push({
      event_id: "tripletex:10:invoice.paid:9001",
      status: "PROCESSED",
    });
    const res = await TripletexWebhookPOST(
      mkReq({ subscriptionId: 10, event: "invoice.paid", id: 9001 }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data?.duplicate).toBe(true);
    expect(providerInvoices[0].status).toBe("SENT");
    expect(webhookEvents.length).toBe(1);
  });
});

describe("Tripletex webhook — unknown event", () => {
  test("unsupported event_type → 200 IGNORED", async () => {
    const res = await TripletexWebhookPOST(
      mkReq({ subscriptionId: 3, event: "product.create", id: 42 }),
    );
    expect(res.status).toBe(200);
    const row = webhookEvents.find((r) => r.event_id === "tripletex:3:product.create:42");
    expect(row?.status).toBe("IGNORED");
  });
});

describe("Tripletex webhook — unknown invoice", () => {
  test("unknown tripletex invoice id → 200 FAILED", async () => {
    const res = await TripletexWebhookPOST(
      mkReq({ subscriptionId: 5, event: "invoice.paid", id: 99999 }),
    );
    expect(res.status).toBe(200);
    const row = webhookEvents.find((r) => r.event_id === "tripletex:5:invoice.paid:99999");
    expect(row?.status).toBe("FAILED");
    expect(row?.error_detail).toBe("UNKNOWN_INVOICE");
  });
});

describe("Tripletex webhook — handler error", () => {
  test("DB update failure → 200 FAILED", async () => {
    const originalFrom = fromMock.getMockImplementation();
    fromMock.mockImplementation((table: string) => {
      if (table === "provider_invoices") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "inv-1", status: "SENT", provider_id: "prov-1" },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              in: async () => ({ error: { message: "DB_DOWN" } }),
            }),
          }),
        };
      }
      return originalFrom!(table);
    });

    const res = await TripletexWebhookPOST(
      mkReq({ subscriptionId: 7, event: "invoice.paid", id: 9001 }),
    );
    expect(res.status).toBe(200);
    const row = webhookEvents.find((r) => r.event_id === "tripletex:7:invoice.paid:9001");
    expect(row?.status).toBe("FAILED");
    expect(row?.error_detail).toContain("DB_DOWN");
  });
});
