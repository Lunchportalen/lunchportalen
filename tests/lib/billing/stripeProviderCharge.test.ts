import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chargeProviderCommissionInvoice } from "@/lib/billing/stripeProviderCharge";

const INVOICE_ID = "inv-1";
const PROVIDER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORG_ID = PROVIDER_ID;
const PERIOD_ID = "period-1";
const ATTEMPT_ID = "attempt-1";

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

function makeAdminMock(overrides?: Partial<Tables>, rpcResult?: Row) {
  const rows: Tables = {
    provider_commission_invoices: [{
      id: INVOICE_ID,
      provider_id: PROVIDER_ID,
      organization_id: ORG_ID,
      commission_period_id: PERIOD_ID,
      total_amount_minor: 12345,
      currency: "NOK",
      payment_status: "pending",
      payment_provider_payment_intent_id: null,
      paid_at: null,
    }],
    organization_billing_profiles: [{
      organization_id: PROVIDER_ID,
      payment_provider: "stripe",
      payment_provider_customer_id: "cus_123",
      default_payment_method_id: "pm-row-1",
      billing_currency: "NOK",
    }],
    payment_methods: [{
      id: "pm-row-1",
      organization_id: PROVIDER_ID,
      provider: "stripe",
      provider_payment_method_id: "pm_card_123",
      status: "chargeable",
    }],
    billing_payment_attempts: [],
    billing_audit_log: [],
    ...(overrides ?? {}),
  };

  const rpc = vi.fn(async (name: string) => {
    if (name === "lp_billing_apply_payment_recovery_policy") return { data: null, error: null };
    return {
      data: rpcResult ?? {
      provider_invoice_id: INVOICE_ID,
      provider_id: PROVIDER_ID,
      organization_id: ORG_ID,
      commission_period_id: PERIOD_ID,
      currency: "NOK",
      amount_minor: 12345,
      payment_provider: "stripe",
      payment_provider_customer_id_present: true,
      default_payment_method_present: true,
      default_payment_method_status: "chargeable",
      payment_charge_ready: true,
      invoice_payment_status: "pending",
      can_create_payment_intent: true,
      can_confirm_charge: false,
      missing_requirements: [],
      stripe_preview_metadata: {
        provider_invoice_id: INVOICE_ID,
        provider_id: PROVIDER_ID,
        organization_id: ORG_ID,
        commission_period_id: PERIOD_ID,
        currency: "nok",
        amount_minor: 12345,
        purpose: "lunchportalen_commission_invoice",
      },
      idempotency_key: "idem-1",
      created_new: false,
    },
      error: null,
    };
  });

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
        const found = (rows[name] ?? []).find((row) => filters.every(([key, value]) => row[key] === value));
        return { data: found ?? null, error: null };
      },
      single: async () => {
        if (insertPayload) return { data: insertPayload, error: null };
        const found = (rows[name] ?? []).find((row) => filters.every(([key, value]) => row[key] === value));
        return { data: found ?? null, error: found ? null : { message: "not found" } };
      },
      insert: (value: Row) => {
        insertPayload = { ...value };
        rows[name] ??= [];
        if (name === "billing_payment_attempts" && !insertPayload.id) insertPayload.id = ATTEMPT_ID;
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
      rpc,
    } as any,
  };
}

function makeStripeMock(status = "succeeded", error?: any) {
  return {
    paymentIntents: {
      create: vi.fn(async (_params: any, _opts: any) => {
        if (error) throw error;
        return { id: "pi_123", status };
      }),
    },
  } as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_mock";
  // Fase 9: oppgjør er invoice-only by default; kortbelastning er eksplisitt
  // deaktivert bak server-side policy. Denne suiten tester den DORMANTE
  // kodebanen og må derfor opt-e inn eksplisitt.
  process.env.PLATFORM_SETTLEMENT_MODE = "card";
});

afterEach(() => {
  delete process.env.PLATFORM_SETTLEMENT_MODE;
});

describe("stripeProviderCharge", () => {
  it("creates an off-session confirmed PaymentIntent from invoice amount and currency", async () => {
    const { admin, rows } = makeAdminMock();
    const stripe = makeStripeMock("succeeded");

    const res = await chargeProviderCommissionInvoice({ providerInvoiceId: INVOICE_ID, idempotencyKey: "idem-1" }, { admin, stripe });

    expect(res).toMatchObject({
      ok: true,
      paymentAttemptId: ATTEMPT_ID,
      stripePaymentIntentId: "pi_123",
      paymentStatus: "paid",
      chargeSucceeded: true,
      createdNew: true,
    });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 12345,
        currency: "nok",
        customer: "cus_123",
        payment_method: "pm_card_123",
        off_session: true,
        confirm: true,
        metadata: expect.objectContaining({
          provider_invoice_id: INVOICE_ID,
          payment_attempt_id: ATTEMPT_ID,
        }),
      }),
      { idempotencyKey: "idem-1" },
    );
    expect(rows.provider_commission_invoices[0].payment_status).toBe("paid");
    expect(rows.provider_commission_invoices[0].payment_provider_payment_intent_id).toBe("pi_123");
    expect(JSON.stringify(rows)).not.toContain("4242424242424242");
    expect(admin.rpc).toHaveBeenCalledWith("lp_billing_apply_payment_recovery_policy", expect.objectContaining({
      p_payment_status: "paid",
    }));
  });

  it("blocks when dry-run cannot create payment intent", async () => {
    const { admin } = makeAdminMock(undefined, {
      can_create_payment_intent: false,
      missing_requirements: ["payment_method_missing"],
    });
    const stripe = makeStripeMock();

    const res = await chargeProviderCommissionInvoice({ providerInvoiceId: INVOICE_ID }, { admin, stripe });

    expect(res).toMatchObject({
      ok: false,
      code: "CHARGE_PREVIEW_BLOCKED",
      missingRequirements: ["payment_method_missing"],
    });
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("returns existing attempt for duplicate idempotency key without Stripe call", async () => {
    const { admin } = makeAdminMock({
      billing_payment_attempts: [{
        id: "attempt-existing",
        provider_invoice_id: INVOICE_ID,
        provider_payment_intent_id: "pi_existing",
        status: "succeeded",
        requires_action: false,
        idempotency_key: "idem-dup",
      }],
    });
    const stripe = makeStripeMock();

    const res = await chargeProviderCommissionInvoice({ providerInvoiceId: INVOICE_ID, idempotencyKey: "idem-dup" }, { admin, stripe });

    expect(res).toMatchObject({
      ok: true,
      paymentAttemptId: "attempt-existing",
      stripePaymentIntentId: "pi_existing",
      createdNew: false,
      chargeSucceeded: true,
    });
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("stores safe failed attempt for card decline without retry or email", async () => {
    const { admin, rows } = makeAdminMock();
    const stripe = makeStripeMock("failed", { code: "card_declined", message: "Your card was declined" });

    const res = await chargeProviderCommissionInvoice({ providerInvoiceId: INVOICE_ID, idempotencyKey: "idem-fail" }, { admin, stripe });

    expect(res).toMatchObject({
      ok: true,
      paymentStatus: "failed",
      chargeFailed: true,
      createdNew: true,
    });
    expect(rows.billing_payment_attempts[0].status).toBe("failed");
    expect(rows.billing_payment_attempts[0].failure_code).toBe("card_declined");
    expect(rows.provider_commission_invoices[0].payment_status).toBe("failed");
    expect(admin.rpc).toHaveBeenCalledWith("lp_billing_apply_payment_recovery_policy", expect.objectContaining({
      p_payment_status: "failed",
      p_failure_code: "card_declined",
    }));
  });

  it("stores requires_action without automatic retry", async () => {
    const { admin, rows } = makeAdminMock();
    const stripe = makeStripeMock("failed", { code: "authentication_required", message: "Authentication required" });

    const res = await chargeProviderCommissionInvoice({ providerInvoiceId: INVOICE_ID, idempotencyKey: "idem-action" }, { admin, stripe });

    expect(res).toMatchObject({
      ok: true,
      paymentStatus: "action_required",
      requiresAction: true,
      chargeFailed: false,
    });
    expect(rows.billing_payment_attempts[0].status).toBe("requires_action");
    expect(rows.provider_commission_invoices[0].payment_status).toBe("action_required");
    expect(admin.rpc).toHaveBeenCalledWith("lp_billing_apply_payment_recovery_policy", expect.objectContaining({
      p_payment_status: "action_required",
      p_failure_code: "authentication_required",
    }));
  });
});
