import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { createInvoiceMock, resolveTripletexAuthMock, TripletexClientError } = vi.hoisted(() => {
  class TripletexClientError extends Error {
    readonly kind: string;
    readonly code: string;
    readonly status: number | null;
    constructor(input: {
      message: string;
      kind: string;
      code: string;
      status?: number | null;
    }) {
      super(input.message);
      this.name = "TripletexClientError";
      this.kind = input.kind;
      this.code = input.code;
      this.status = input.status ?? null;
    }
  }

  return {
    createInvoiceMock: vi.fn(),
    resolveTripletexAuthMock: vi.fn(),
    TripletexClientError,
  };
});

vi.mock("@/lib/integrations/tripletex/client", () => ({
  createInvoice: (...args: unknown[]) => createInvoiceMock(...args),
  resolveTripletexAuth: (...args: unknown[]) => resolveTripletexAuthMock(...args),
  classifyTripletexError: (error: unknown) => error,
  TripletexClientError,
}));

import { handleSaasInvoiceCreateLp } from "@/lib/integrations/tripletex/providerSaasInvoiceSync";

const PROVIDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const INVOICE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const EVENT_KEY = `tripletex.saas_invoice_create_lp:${INVOICE_ID}`;

type TableState = {
  tripletex_exports: Array<Record<string, unknown>>;
  provider_invoices: Array<Record<string, unknown>>;
  tripletex_customers: Array<Record<string, unknown>>;
  billing_tax_codes: Array<Record<string, unknown>>;
  lifecycle_audit_log: Array<Record<string, unknown>>;
};

function createAdminMock(state: TableState) {
  const chain = (table: keyof TableState) => {
    let rows = [...state[table]];
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];

    const api = {
      select: () => api,
      eq: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return api;
      },
      is: (col: string, val: null) => {
        filters.push((r) => r[col] === val);
        return api;
      },
      maybeSingle: async () => {
        const match = rows.filter((r) => filters.every((f) => f(r)))[0] ?? null;
        return { data: match, error: null };
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => ({
          eq: async (col2: string, val2: unknown) => {
            rows = state[table];
            for (const row of rows) {
              if (row[col] === val && row[col2] === val2) {
                Object.assign(row, patch);
              }
            }
            state[table] = rows;
            return { error: null };
          },
        }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        const key = safeStr(row.unique_ref);
        const idx = state[table].findIndex((r) => safeStr(r.unique_ref) === key);
        if (idx >= 0) state[table][idx] = { ...state[table][idx], ...row };
        else state[table].push(row);
        return { error: null };
      },
      insert: async (row: Record<string, unknown>) => {
        state[table].push(row);
        return { error: null };
      },
    };

    rows = state[table];
    return api;
  };

  return { from: (table: string) => chain(table as keyof TableState) };
}

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function baseState(overrides?: Partial<TableState>): TableState {
  return {
    tripletex_exports: [],
    provider_invoices: [
      {
        id: INVOICE_ID,
        provider_id: PROVIDER_ID,
        invoice_number: "LP-SAAS-TEST-202605",
        invoice_period: "2026-05-01",
        amount_net: 1000,
        amount_tax: 250,
        amount_total: 1250,
        tax_code_id: "MVA_25",
        status: "DRAFT",
        tripletex_invoice_id: null,
      },
    ],
    tripletex_customers: [
      {
        provider_id: PROVIDER_ID,
        company_id: null,
        tripletex_customer_id: "tx-customer-1",
      },
    ],
    billing_tax_codes: [{ id: "MVA_25", tripletex_vat_code: "3" }],
    lifecycle_audit_log: [],
    ...overrides,
  };
}

describe("handleSaasInvoiceCreateLp (TPT-A-4)", () => {
  const originalProduct = process.env.TRIPLETEX_REVENUE_DEFAULT_PRODUCT_ID;
  const originalVat = process.env.TRIPLETEX_REVENUE_DEFAULT_VAT_CODE;
  const origFlow1 = process.env.TRIPLETEX_FLOW_1_ENABLED;

  beforeEach(() => {
    createInvoiceMock.mockReset();
    resolveTripletexAuthMock.mockReset();
    resolveTripletexAuthMock.mockResolvedValue({ companyId: "1", token: "tok" });
    process.env.TRIPLETEX_REVENUE_DEFAULT_PRODUCT_ID = "prod-99";
    process.env.TRIPLETEX_REVENUE_DEFAULT_VAT_CODE = "3";
    process.env.TRIPLETEX_FLOW_1_ENABLED = "true";
  });

  afterEach(() => {
    if (originalProduct === undefined) delete process.env.TRIPLETEX_REVENUE_DEFAULT_PRODUCT_ID;
    else process.env.TRIPLETEX_REVENUE_DEFAULT_PRODUCT_ID = originalProduct;
    if (originalVat === undefined) delete process.env.TRIPLETEX_REVENUE_DEFAULT_VAT_CODE;
    else process.env.TRIPLETEX_REVENUE_DEFAULT_VAT_CODE = originalVat;
    if (origFlow1 === undefined) delete process.env.TRIPLETEX_FLOW_1_ENABLED;
    else process.env.TRIPLETEX_FLOW_1_ENABLED = origFlow1;
  });

  test("happy path: creates Tripletex invoice, export, audit", async () => {
    const state = baseState();
    createInvoiceMock.mockResolvedValue({ externalId: "tx-inv-42", raw: {} });

    const result = await handleSaasInvoiceCreateLp(
      createAdminMock(state),
      {
        event_key: EVENT_KEY,
        payload: { invoice_id: INVOICE_ID, provider_id: PROVIDER_ID, target: "lp", request_rid: "rid-1" },
      },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(true);
    expect(createInvoiceMock).toHaveBeenCalledTimes(1);
    expect(state.tripletex_exports).toHaveLength(1);
    expect(state.tripletex_exports[0]?.tripletex_invoice_id).toBe("tx-inv-42");
    expect(state.provider_invoices[0]?.status).toBe("SENT");
    expect(state.lifecycle_audit_log).toHaveLength(1);
    expect(state.lifecycle_audit_log[0]?.action).toBe("provider_saas_invoice_created");
  });

  test("idempotency: existing tripletex_exports skips createInvoice", async () => {
    const state = baseState({
      tripletex_exports: [
        { unique_ref: `lp_saas:${INVOICE_ID}`, tripletex_invoice_id: "tx-existing" },
      ],
    });

    const result = await handleSaasInvoiceCreateLp(
      createAdminMock(state),
      { event_key: EVENT_KEY, payload: { target: "lp" } },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(true);
    expect(createInvoiceMock).not.toHaveBeenCalled();
    expect(state.provider_invoices[0]?.status).toBe("SENT");
  });

  test("idempotency: invoice already SENT", async () => {
    const state = baseState({
      provider_invoices: [
        {
          id: INVOICE_ID,
          provider_id: PROVIDER_ID,
          amount_net: 1000,
          tax_code_id: "MVA_25",
          status: "SENT",
          tripletex_invoice_id: "tx-sent",
        },
      ],
    });

    const result = await handleSaasInvoiceCreateLp(
      createAdminMock(state),
      { event_key: EVENT_KEY, payload: { target: "lp" } },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(true);
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  test("permanent: missing Tripletex customer mapping", async () => {
    const state = baseState({ tripletex_customers: [] });

    const result = await handleSaasInvoiceCreateLp(
      createAdminMock(state),
      { event_key: EVENT_KEY, payload: { target: "lp" } },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.error).toBe("TRIPLETEX_PROVIDER_CUSTOMER_MISSING");
  });

  test("permanent: CONFIG_MISSING when product env unset", async () => {
    delete process.env.TRIPLETEX_REVENUE_DEFAULT_PRODUCT_ID;
    const state = baseState();

    const result = await handleSaasInvoiceCreateLp(
      createAdminMock(state),
      { event_key: EVENT_KEY, payload: { target: "lp" } },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
  });

  test("permanent: INVALID_PAYLOAD_TARGET", async () => {
    const result = await handleSaasInvoiceCreateLp(
      createAdminMock(baseState()),
      { event_key: EVENT_KEY, payload: { target: "provider" } },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.error).toBe("INVALID_PAYLOAD_TARGET");
  });
});
