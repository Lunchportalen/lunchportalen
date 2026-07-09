import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createProviderPaymentSetupSession,
  ensureProviderStripeCustomer,
  handleProviderStripeSetupWebhook,
} from "@/lib/billing/stripeProviderSetup";

const PROVIDER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const USER_ID = "11111111-2222-4333-8444-555555555555";

type TableRows = Record<string, Array<Record<string, any>>>;

function createAdminMock(initial?: Partial<TableRows>) {
  const rows: TableRows = {
    organization_billing_profiles: [
      {
        organization_id: PROVIDER_ID,
        legal_name: "Provider AS",
        billing_email_current: "billing@example.no",
        payment_provider_customer_id: null,
        default_payment_method_id: null,
        billing_status: "setup_required",
      },
    ],
    payment_methods: [],
    billing_audit_log: [],
    stripe_billing_webhook_events: [],
    ...(initial ?? {}),
  };

  function matches(row: Record<string, any>, filters: Array<[string, unknown]>) {
    return filters.every(([key, value]) => row[key] === value);
  }

  function table(name: string) {
    const filters: Array<[string, unknown]> = [];
    let patch: Record<string, any> | null = null;
    let insertPayload: Record<string, any> | null = null;
    const api: any = {
      select: () => api,
      eq: (key: string, value: unknown) => {
        filters.push([key, value]);
        return api;
      },
      in: (key: string, values: unknown[]) => {
        filters.push([key, values]);
        return api;
      },
      maybeSingle: async () => {
        const found = (rows[name] ?? []).find((row) =>
          filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value),
        );
        return { data: found ?? null, error: null };
      },
      single: async () => {
        const found = (rows[name] ?? []).find((row) => matches(row, filters));
        return { data: found ?? null, error: found ? null : { message: "not found" } };
      },
      update: (value: Record<string, any>) => {
        patch = value;
        return api;
      },
      insert: (value: Record<string, any>) => {
        insertPayload = { ...value };
        rows[name] ??= [];
        if (name === "payment_methods" && !insertPayload.id) insertPayload.id = `pm-row-${rows[name].length + 1}`;
        rows[name].push(insertPayload);
        return api;
      },
      then: (resolve: (value: { data?: any; error: any }) => void) => {
        if (patch) {
          for (const row of rows[name] ?? []) {
            if (filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value)) {
              Object.assign(row, patch);
            }
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
    } as any,
  };
}

function createStripeMock() {
  const paymentMethod = {
    id: "pm_card_123",
    customer: "cus_123",
    card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2031 },
  };

  return {
    stripe: {
      customers: {
        create: vi.fn(async () => ({ id: "cus_123" })),
      },
      checkout: {
        sessions: {
          create: vi.fn(async (input: any) => ({
            id: "cs_setup_123",
            url: "https://checkout.stripe.test/setup",
            ...input,
          })),
        },
      },
      paymentMethods: {
        retrieve: vi.fn(async () => paymentMethod),
      },
      webhooks: {
        constructEvent: vi.fn((raw: string, sig: string) => {
          if (sig !== "valid") throw new Error("bad signature");
          return JSON.parse(raw);
        }),
      },
    } as any,
    paymentMethod,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_mock";
  process.env.STRIPE_PROVIDER_SETUP_WEBHOOK_SECRET = "whsec_mock";
});

describe("stripeProviderSetup", () => {
  it("fails closed when billing profile is missing", async () => {
    const { admin } = createAdminMock({ organization_billing_profiles: [] });
    const { stripe } = createStripeMock();

    await expect(ensureProviderStripeCustomer(PROVIDER_ID, { admin, stripe })).resolves.toMatchObject({
      ok: false,
      code: "BILLING_PROFILE_NOT_FOUND",
    });
  });

  it("reuses existing customer id", async () => {
    const { admin } = createAdminMock({
      organization_billing_profiles: [{ organization_id: PROVIDER_ID, payment_provider_customer_id: "cus_existing" }],
    });
    const { stripe } = createStripeMock();

    await expect(ensureProviderStripeCustomer(PROVIDER_ID, { admin, stripe })).resolves.toEqual({
      ok: true,
      customerId: "cus_existing",
    });
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });

  it("creates setup-mode checkout session without charge line items", async () => {
    const { admin } = createAdminMock();
    const { stripe } = createStripeMock();

    const res = await createProviderPaymentSetupSession({
      providerId: PROVIDER_ID,
      actorUserId: USER_ID,
      actorEmail: "admin@example.no",
    }, { admin, stripe });

    expect(res).toMatchObject({ ok: true, url: "https://checkout.stripe.test/setup" });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: "setup",
      customer: "cus_123",
      client_reference_id: PROVIDER_ID,
      payment_method_types: ["card"],
      metadata: expect.objectContaining({
        off_session_consent: "monthly_commission_charge_future",
      }),
    }));
    expect(stripe.checkout.sessions.create.mock.calls[0][0].line_items).toBeUndefined();
  });

  it("rejects invalid webhook signature", async () => {
    const { admin } = createAdminMock();
    const { stripe } = createStripeMock();

    const res = await handleProviderStripeSetupWebhook("{}", "invalid", { admin, stripe });
    expect(res).toMatchObject({ ok: false, code: "INVALID_SIGNATURE" });
  });

  it("stores only payment method metadata on setup_intent.succeeded and replaces old default", async () => {
    const { admin, rows } = createAdminMock({
      organization_billing_profiles: [{
        organization_id: PROVIDER_ID,
        legal_name: "Provider AS",
        payment_provider_customer_id: "cus_123",
        default_payment_method_id: "old-pm",
      }],
      payment_methods: [{
        id: "old-pm",
        organization_id: PROVIDER_ID,
        provider: "stripe",
        provider_payment_method_id: "pm_old",
        brand: "visa",
        last4: "1111",
        exp_month: 1,
        exp_year: 2030,
        status: "chargeable",
      }],
    });
    const { stripe } = createStripeMock();
    const raw = JSON.stringify({
      id: "evt_setup_1",
      type: "setup_intent.succeeded",
      data: {
        object: {
          customer: "cus_123",
          payment_method: "pm_card_123",
          metadata: { organization_id: PROVIDER_ID, actor_user_id: USER_ID },
        },
      },
    });

    await expect(handleProviderStripeSetupWebhook(raw, "valid", { admin, stripe })).resolves.toMatchObject({ ok: true });
    expect(rows.payment_methods.find((row) => row.id === "old-pm")?.status).toBe("replaced");
    expect(rows.payment_methods.some((row) => row.provider_payment_method_id === "pm_card_123" && row.status === "chargeable")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("4242424242424242");
    expect(JSON.stringify(rows)).not.toContain("cvv");
    expect(rows.billing_audit_log.some((row) => row.action === "payment_method.attached")).toBe(true);
  });

  it("handles duplicate webhook idempotently", async () => {
    const { admin } = createAdminMock({
      stripe_billing_webhook_events: [{ id: "row-1", stripe_event_id: "evt_dup" }],
    });
    const { stripe } = createStripeMock();
    const raw = JSON.stringify({
      id: "evt_dup",
      type: "payment_method.attached",
      data: { object: { id: "pm_card_123", customer: "cus_123", card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2031 } } },
    });

    await expect(handleProviderStripeSetupWebhook(raw, "valid", { admin, stripe })).resolves.toMatchObject({
      ok: true,
      duplicate: true,
    });
  });
});
