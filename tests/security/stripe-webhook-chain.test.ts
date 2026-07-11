/**
 * SEC-001 / C2 regression: middleware allowlist → webhook route → signature validation → idempotency.
 *
 * Chain under test:
 *   middleware (isApiAuthAllowlisted) → POST /api/webhooks/stripe-billing-payments
 *   → handleProviderStripePaymentWebhook (constructEvent signature check)
 *   → stripe_billing_webhook_events idempotency layer → accounting writes.
 */
// @ts-nocheck
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import { isApiAuthAllowlisted } from "@/lib/server/auth/apiAllowlist";
import { handleProviderStripePaymentWebhook } from "@/lib/billing/stripePaymentWebhook";

/* =========================================================
   Fake Stripe + fake admin (deps injection — no network)
========================================================= */

const GOOD_SIG = "t=1,v1=valid";
const WRONG_ACCOUNT_SIG = "t=1,v1=other-account";

function fakeStripe(event: any) {
  return {
    webhooks: {
      constructEvent: (_raw: string, signature: string, _secret: string) => {
        // Simulates Stripe SDK: throws unless signature was produced with our secret.
        if (signature !== GOOD_SIG) throw new Error("No signatures found matching the expected signature");
        return event;
      },
    },
  } as any;
}

type AdminState = {
  webhookEvents: Map<string, any>;
  attempts: Map<string, any>;
  invoiceUpdates: any[];
  attemptUpdates: any[];
  auditRows: any[];
  rpcCalls: any[];
  failIdempotencyInsert: boolean;
};

function freshState(): AdminState {
  return {
    webhookEvents: new Map(),
    attempts: new Map(),
    invoiceUpdates: [],
    attemptUpdates: [],
    auditRows: [],
    rpcCalls: [],
    failIdempotencyInsert: false,
  };
}

function fakeAdmin(state: AdminState) {
  return {
    rpc: async (fn: string, args: any) => {
      state.rpcCalls.push({ fn, args });
      return { data: null, error: null };
    },
    from: (table: string) => {
      const ctx: any = { table, filters: {} };
      const q: any = {
        select: () => q,
        eq: (col: string, val: any) => {
          ctx.filters[col] = val;
          return q;
        },
        maybeSingle: async () => {
          if (table === "stripe_billing_webhook_events") {
            const id = ctx.filters["stripe_event_id"];
            return { data: state.webhookEvents.get(id) ?? null, error: null };
          }
          if (table === "billing_payment_attempts") {
            const pi = ctx.filters["provider_payment_intent_id"];
            return { data: state.attempts.get(pi) ?? null, error: null };
          }
          return { data: null, error: null };
        },
        insert: async (row: any) => {
          if (table === "stripe_billing_webhook_events") {
            if (state.failIdempotencyInsert) return { error: { code: "XX000", message: "db down" } };
            if (state.webhookEvents.has(row.stripe_event_id)) return { error: { code: "23505", message: "duplicate" } };
            state.webhookEvents.set(row.stripe_event_id, { id: `we_${row.stripe_event_id}`, ...row });
            return { error: null };
          }
          if (table === "billing_audit_log") {
            state.auditRows.push(row);
            return { error: null };
          }
          return { error: null };
        },
        update: (patch: any) => ({
          eq: async (_col: string, val: any) => {
            if (table === "billing_payment_attempts") state.attemptUpdates.push({ id: val, patch });
            if (table === "provider_commission_invoices") state.invoiceUpdates.push({ id: val, patch });
            return { error: null };
          },
        }),
      };
      return q;
    },
  } as any;
}

function piSucceededEvent(id = "evt_1") {
  return {
    id,
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_1", status: "succeeded" } },
  };
}

/* =========================================================
   Tests
========================================================= */

let state: AdminState;

beforeEach(() => {
  state = freshState();
  state.attempts.set("pi_1", {
    id: "att_1",
    provider_invoice_id: "inv_1",
    provider_id: "prov_1",
    organization_id: "org_1",
    status: "processing",
  });
  vi.stubEnv("STRIPE_BILLING_PAYMENTS_WEBHOOK_SECRET", "whsec_test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware allowlist (SEC-001)", () => {
  test("stripe webhook routes pass middleware without session", () => {
    expect(isApiAuthAllowlisted("/api/webhooks/stripe-billing-payments", "POST")).toBe(true);
    expect(isApiAuthAllowlisted("/api/webhooks/stripe-provider-setup", "POST")).toBe(true);
  });

  test("non-allowlisted API routes still require session", () => {
    expect(isApiAuthAllowlisted("/api/orders", "POST")).toBe(false);
    expect(isApiAuthAllowlisted("/api/superadmin/companies/set-status", "POST")).toBe(false);
  });
});

describe("webhook handler: signature validation", () => {
  test("valid event is processed (attempt + invoice + recovery policy + audit)", async () => {
    const res = await handleProviderStripePaymentWebhook("raw", GOOD_SIG, {
      stripe: fakeStripe(piSucceededEvent()),
      admin: fakeAdmin(state),
    });
    expect(res.ok).toBe(true);
    expect(state.attemptUpdates.length).toBe(1);
    expect(state.attemptUpdates[0].patch.status).toBe("succeeded");
    expect(state.invoiceUpdates.length).toBe(1);
    expect(state.invoiceUpdates[0].patch.payment_status).toBe("paid");
    expect(state.rpcCalls.map((c) => c.fn)).toContain("lp_billing_apply_payment_recovery_policy");
    expect(state.auditRows.length).toBe(1);
  });

  test("invalid signature is rejected before any DB access", async () => {
    const res = await handleProviderStripePaymentWebhook("raw", "t=1,v1=tampered", {
      stripe: fakeStripe(piSucceededEvent()),
      admin: fakeAdmin(state),
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("INVALID_SIGNATURE");
    expect(state.webhookEvents.size).toBe(0);
    expect(state.attemptUpdates).toEqual([]);
  });

  test("missing signature is rejected", async () => {
    const res = await handleProviderStripePaymentWebhook("raw", null, {
      stripe: fakeStripe(piSucceededEvent()),
      admin: fakeAdmin(state),
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("INVALID_SIGNATURE");
  });

  test("event signed for a different Stripe account/secret is rejected", async () => {
    const res = await handleProviderStripePaymentWebhook("raw", WRONG_ACCOUNT_SIG, {
      stripe: fakeStripe(piSucceededEvent()),
      admin: fakeAdmin(state),
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("INVALID_SIGNATURE");
  });

  test("missing webhook secret env fails closed (no processing)", async () => {
    vi.stubEnv("STRIPE_BILLING_PAYMENTS_WEBHOOK_SECRET", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await handleProviderStripePaymentWebhook("raw", GOOD_SIG, {
      stripe: fakeStripe(piSucceededEvent()),
      admin: fakeAdmin(state),
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("WEBHOOK_SECRET_MISSING");
  });
});

describe("webhook handler: idempotency + retry", () => {
  test("duplicate event id does not write twice", async () => {
    const deps = { stripe: fakeStripe(piSucceededEvent("evt_dup")), admin: fakeAdmin(state) };
    const first = await handleProviderStripePaymentWebhook("raw", GOOD_SIG, deps);
    expect(first.ok).toBe(true);

    const second = await handleProviderStripePaymentWebhook("raw", GOOD_SIG, deps);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.duplicate).toBe(true);

    // Accounting writes happened exactly once.
    expect(state.attemptUpdates.length).toBe(1);
    expect(state.invoiceUpdates.length).toBe(1);
    expect(state.auditRows.length).toBe(1);
  });

  test("webhook replay after success returns duplicate (safe retry)", async () => {
    const deps = { stripe: fakeStripe(piSucceededEvent("evt_replay")), admin: fakeAdmin(state) };
    await handleProviderStripePaymentWebhook("raw", GOOD_SIG, deps);
    for (let i = 0; i < 3; i++) {
      const replay = await handleProviderStripePaymentWebhook("raw", GOOD_SIG, deps);
      expect(replay.ok).toBe(true);
      if (replay.ok) expect(replay.duplicate).toBe(true);
    }
    expect(state.attemptUpdates.length).toBe(1);
  });

  test("unknown event type is ignored without writes", async () => {
    const res = await handleProviderStripePaymentWebhook("raw", GOOD_SIG, {
      stripe: fakeStripe({ id: "evt_x", type: "customer.created", data: { object: {} } }),
      admin: fakeAdmin(state),
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ignored).toBe(true);
    expect(state.webhookEvents.size).toBe(0);
  });

  test("unmatched payment intent is recorded and reported (no accounting writes)", async () => {
    state.attempts.clear();
    const res = await handleProviderStripePaymentWebhook("raw", GOOD_SIG, {
      stripe: fakeStripe(piSucceededEvent("evt_unmatched")),
      admin: fakeAdmin(state),
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.unmatched).toBe(true);
    expect(state.attemptUpdates).toEqual([]);
  });

  test("database failure on idempotency insert returns error (Stripe will retry)", async () => {
    state.failIdempotencyInsert = true;
    const res = await handleProviderStripePaymentWebhook("raw", GOOD_SIG, {
      stripe: fakeStripe(piSucceededEvent("evt_dbfail")),
      admin: fakeAdmin(state),
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("WEBHOOK_IDEMPOTENCY_WRITE_FAILED");
    // No accounting writes happened without idempotency record.
    expect(state.attemptUpdates).toEqual([]);
  });

  test("payment failure event maps to failed status + recovery policy", async () => {
    const failedEvent = {
      id: "evt_fail",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_1",
          status: "requires_payment_method",
          last_payment_error: { code: "card_declined", decline_code: "insufficient_funds", message: "Insufficient funds" },
        },
      },
    };
    const res = await handleProviderStripePaymentWebhook("raw", GOOD_SIG, {
      stripe: fakeStripe(failedEvent),
      admin: fakeAdmin(state),
    });
    expect(res.ok).toBe(true);
    expect(state.attemptUpdates[0].patch.status).toBe("failed");
    expect(state.attemptUpdates[0].patch.failure_code).toBe("insufficient_funds");
    expect(state.invoiceUpdates[0].patch.payment_status).toBe("failed");
    const recovery = state.rpcCalls.find((c) => c.fn === "lp_billing_apply_payment_recovery_policy");
    expect(recovery.args.p_payment_status).toBe("failed");
  });
});

describe("route handler contract", () => {
  test("POST maps INVALID_SIGNATURE to 400 and success to 200", async () => {
    vi.resetModules();
    vi.doMock("@/lib/billing/stripePaymentWebhook", () => ({
      handleProviderStripePaymentWebhook: vi.fn(async (_raw: string, sig: string | null) =>
        sig === GOOD_SIG ? { ok: true, duplicate: false } : { ok: false, code: "INVALID_SIGNATURE", message: "Ugyldig Stripe-signatur." }
      ),
    }));
    const mod = await import("../../app/api/webhooks/stripe-billing-payments/route");

    const bad = await mod.POST(
      new Request("http://localhost/api/webhooks/stripe-billing-payments", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=tampered" },
        body: "{}",
      }) as any,
    );
    expect(bad.status).toBe(400);
    const badJson = await bad.json();
    expect(badJson.ok).toBe(false);
    expect(badJson.rid).toBeTruthy();

    const good = await mod.POST(
      new Request("http://localhost/api/webhooks/stripe-billing-payments", {
        method: "POST",
        headers: { "stripe-signature": GOOD_SIG },
        body: "{}",
      }) as any,
    );
    expect(good.status).toBe(200);
    const goodJson = await good.json();
    expect(goodJson.ok).toBe(true);
    expect(goodJson.data.received).toBe(true);
    vi.doUnmock("@/lib/billing/stripePaymentWebhook");
  });
});
