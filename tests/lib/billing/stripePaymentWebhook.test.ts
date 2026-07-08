import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleProviderStripePaymentWebhook } from "@/lib/billing/stripePaymentWebhook";

const ATTEMPT_ID = "attempt-1";
const INVOICE_ID = "invoice-1";
const PROVIDER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORG_ID = PROVIDER_ID;
const PI_ID = "pi_123";

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

function makeAdminMock(initial?: Partial<Tables>) {
  const rows: Tables = {
    billing_payment_attempts: [{
      id: ATTEMPT_ID,
      provider_invoice_id: INVOICE_ID,
      provider_id: PROVIDER_ID,
      organization_id: ORG_ID,
      provider_payment_intent_id: PI_ID,
      status: "processing",
      requires_action: false,
    }],
    provider_commission_invoices: [{
      id: INVOICE_ID,
      payment_status: "processing",
      paid_at: null,
      amount_ex_tax_minor: 12345,
      total_amount_minor: 12345,
      currency: "NOK",
      sent_to_emails_snapshot: ["billing@example.no"],
    }],
    stripe_billing_webhook_events: [],
    billing_audit_log: [],
    invoice_deliveries: [],
    ...(initial ?? {}),
  };

  function table(name: string) {
    const filters: Array<[string, any]> = [];
    let patch: Row | null = null;
    let insertPayload: Row | null = null;
    const api: any = {
      select: () => api,
      eq: (key: string, value: any) => {
        filters.push([key, value]);
        return api;
      },
      maybeSingle: async () => {
        const row = (rows[name] ?? []).find((candidate) => filters.every(([key, value]) => candidate[key] === value));
        return { data: row ?? null, error: null };
      },
      insert: (value: Row) => {
        insertPayload = { ...value };
        rows[name] ??= [];
        if (name === "stripe_billing_webhook_events") {
          const duplicate = rows[name].some((row) => row.stripe_event_id === insertPayload?.stripe_event_id);
          if (duplicate) {
            return { ...api, then: (resolve: any) => resolve({ error: { code: "23505", message: "duplicate" } }) };
          }
        }
        rows[name].push(insertPayload);
        return api;
      },
      update: (value: Row) => {
        patch = value;
        return api;
      },
      then: (resolve: (value: { data?: any; error: any }) => void) => {
        if (patch) {
          for (const row of rows[name] ?? []) {
            if (filters.every(([key, value]) => row[key] === value)) Object.assign(row, patch);
          }
          resolve({ error: null });
          return;
        }
        if (insertPayload) {
          resolve({ data: insertPayload, error: null });
          return;
        }
        resolve({ error: null });
      },
    };
    return api;
  }

  return {
    rows,
    admin: {
      from: vi.fn((name: string) => table(name)),
      rpc: vi.fn(async () => ({ data: null, error: null })),
    } as any,
  };
}

function makeStripeMock() {
  return {
    webhooks: {
      constructEvent: vi.fn((raw: string, signature: string) => {
        if (signature !== "valid") throw new Error("invalid signature");
        return JSON.parse(raw);
      }),
    },
  } as any;
}

function paymentIntentEvent(type: string, overrides: Record<string, any> = {}) {
  return JSON.stringify({
    id: `evt_${type.replace(/\W/g, "_")}`,
    type,
    data: {
      object: {
        id: PI_ID,
        status: type.split(".").pop(),
        ...overrides,
      },
    },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.STRIPE_BILLING_PAYMENTS_WEBHOOK_SECRET = "whsec_mock";
  process.env.STRIPE_SECRET_KEY = "sk_test_mock";
});

describe("stripePaymentWebhook", () => {
  it("rejects invalid signature", async () => {
    const { admin } = makeAdminMock();
    const stripe = makeStripeMock();

    await expect(handleProviderStripePaymentWebhook("{}", "invalid", { admin, stripe })).resolves.toMatchObject({
      ok: false,
      code: "INVALID_SIGNATURE",
    });
  });

  it("marks attempt and invoice paid on payment_intent.succeeded", async () => {
    const { admin, rows } = makeAdminMock();
    const stripe = makeStripeMock();

    await expect(handleProviderStripePaymentWebhook(paymentIntentEvent("payment_intent.succeeded"), "valid", { admin, stripe })).resolves.toMatchObject({ ok: true });

    expect(rows.billing_payment_attempts[0].status).toBe("succeeded");
    expect(rows.provider_commission_invoices[0].payment_status).toBe("paid");
    expect(rows.provider_commission_invoices[0].paid_at).toBeTruthy();
    expect(rows.billing_audit_log.some((row) => row.action === "payment_intent.succeeded")).toBe(true);
    expect(rows.invoice_deliveries).toHaveLength(0);
    expect(admin.rpc).toHaveBeenCalledWith("lp_billing_apply_payment_recovery_policy", expect.objectContaining({
      p_payment_status: "paid",
    }));
  });

  it("marks failed with safe failure fields on payment_intent.payment_failed", async () => {
    const { admin, rows } = makeAdminMock();
    const stripe = makeStripeMock();
    const raw = paymentIntentEvent("payment_intent.payment_failed", {
      last_payment_error: { code: "card_declined", message: "The card was declined", payment_method: { card: { last4: "4242" } } },
    });

    await expect(handleProviderStripePaymentWebhook(raw, "valid", { admin, stripe })).resolves.toMatchObject({ ok: true });

    expect(rows.billing_payment_attempts[0].status).toBe("failed");
    expect(rows.billing_payment_attempts[0].failure_code).toBe("card_declined");
    expect(rows.billing_payment_attempts[0].failure_message_safe).toBe("The card was declined");
    expect(rows.provider_commission_invoices[0].payment_status).toBe("failed");
    expect(JSON.stringify(rows)).not.toContain("4242424242424242");
    expect(admin.rpc).toHaveBeenCalledWith("lp_billing_apply_payment_recovery_policy", expect.objectContaining({
      p_payment_status: "failed",
      p_failure_code: "card_declined",
    }));
  });

  it("marks processing on payment_intent.processing", async () => {
    const { admin, rows } = makeAdminMock();
    const stripe = makeStripeMock();

    await expect(handleProviderStripePaymentWebhook(paymentIntentEvent("payment_intent.processing"), "valid", { admin, stripe })).resolves.toMatchObject({ ok: true });

    expect(rows.billing_payment_attempts[0].status).toBe("processing");
    expect(rows.provider_commission_invoices[0].payment_status).toBe("processing");
    expect(admin.rpc).toHaveBeenCalledWith("lp_billing_apply_payment_recovery_policy", expect.objectContaining({
      p_payment_status: "processing",
    }));
  });

  it("marks action_required without retry", async () => {
    const { admin, rows } = makeAdminMock();
    const stripe = makeStripeMock();

    await expect(handleProviderStripePaymentWebhook(paymentIntentEvent("payment_intent.requires_action"), "valid", { admin, stripe })).resolves.toMatchObject({ ok: true });

    expect(rows.billing_payment_attempts[0].status).toBe("requires_action");
    expect(rows.billing_payment_attempts[0].requires_action).toBe(true);
    expect(rows.provider_commission_invoices[0].payment_status).toBe("action_required");
    expect(admin.rpc).toHaveBeenCalledWith("lp_billing_apply_payment_recovery_policy", expect.objectContaining({
      p_payment_status: "action_required",
    }));
  });

  it("handles duplicate event idempotently without extra mutation", async () => {
    const { admin, rows } = makeAdminMock({
      stripe_billing_webhook_events: [{ id: "evt-row", stripe_event_id: "evt_payment_intent_succeeded" }],
    });
    const stripe = makeStripeMock();

    await expect(handleProviderStripePaymentWebhook(paymentIntentEvent("payment_intent.succeeded"), "valid", { admin, stripe })).resolves.toMatchObject({
      ok: true,
      duplicate: true,
    });
    expect(rows.provider_commission_invoices[0].payment_status).toBe("processing");
  });

  it("stores unmatched event without crashing", async () => {
    const { admin, rows } = makeAdminMock({ billing_payment_attempts: [] });
    const stripe = makeStripeMock();

    await expect(handleProviderStripePaymentWebhook(paymentIntentEvent("payment_intent.succeeded"), "valid", { admin, stripe })).resolves.toMatchObject({
      ok: true,
      unmatched: true,
    });
    expect(rows.stripe_billing_webhook_events[0].status).toBe("unmatched");
  });
});
