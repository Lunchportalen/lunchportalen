import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  createInvoiceMock,
  ensureProviderProductMock,
  ensureProviderVatCodeMock,
  resolveTripletexAuthMock,
  TripletexClientError,
} = vi.hoisted(() => {
  class TripletexClientError extends Error {
    readonly kind: string;
    readonly code: string;
    readonly status: number | null;
    readonly detail: unknown;

    constructor(input: {
      message: string;
      kind: string;
      code: string;
      status?: number | null;
      detail?: unknown;
    }) {
      super(input.message);
      this.name = "TripletexClientError";
      this.kind = input.kind;
      this.code = input.code;
      this.status = input.status ?? null;
      this.detail = input.detail ?? null;
    }
  }

  return {
    createInvoiceMock: vi.fn(),
    ensureProviderProductMock: vi.fn(),
    ensureProviderVatCodeMock: vi.fn(),
    resolveTripletexAuthMock: vi.fn(),
    TripletexClientError,
  };
});

vi.mock("@/lib/integrations/tripletex/client", () => ({
  createInvoice: (...args: unknown[]) => createInvoiceMock(...args),
  ensureProviderProduct: (...args: unknown[]) => ensureProviderProductMock(...args),
  ensureProviderVatCode: (...args: unknown[]) => ensureProviderVatCodeMock(...args),
  resolveTripletexAuth: (...args: unknown[]) => resolveTripletexAuthMock(...args),
  classifyTripletexError: (error: unknown) => error,
  TripletexClientError,
}));

import { handleAgreementInvoiceCreateProvider } from "@/lib/integrations/tripletex/agreementInvoiceSync";

const PROVIDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COMPANY_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const AGREEMENT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const INVOICE_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const EVENT_KEY = `tripletex.agreement_invoice_create_provider:${INVOICE_ID}`;

type TableState = {
  tripletex_exports: Array<Record<string, unknown>>;
  agreement_invoices: Array<Record<string, unknown>>;
  agreement_invoice_lines: Array<Record<string, unknown>>;
  tripletex_customers: Array<Record<string, unknown>>;
  lifecycle_audit_log: Array<Record<string, unknown>>;
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function createAdminMock(state: TableState) {
  const chain = (table: keyof TableState) => {
    let rows = [...state[table]];
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let multiRow = false;

    const api: Record<string, unknown> = {
      select: () => api,
      eq: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return api;
      },
      order: () => {
        multiRow = true;
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
      then: (resolve: (value: { data: unknown; error: null }) => void) => {
        if (multiRow) {
          const matches = rows.filter((r) => filters.every((f) => f(r)));
          resolve({ data: matches, error: null });
        }
      },
    };

    rows = state[table];
    return api;
  };

  return { from: (table: string) => chain(table as keyof TableState) };
}

function baseState(overrides?: Partial<TableState>): TableState {
  return {
    tripletex_exports: [],
    agreement_invoices: [
      {
        id: INVOICE_ID,
        agreement_id: AGREEMENT_ID,
        provider_id: PROVIDER_ID,
        company_id: COMPANY_ID,
        invoice_number: "AGR-TEST-20260501",
        invoice_period_start: "2026-05-01",
        invoice_period_end: "2026-05-31",
        amount_net: 450,
        amount_tax: 67.5,
        amount_total: 517.5,
        status: "DRAFT",
        tripletex_invoice_id: null,
      },
    ],
    agreement_invoice_lines: [
      {
        invoice_id: INVOICE_ID,
        product_key: "BASIS",
        description: "BASIS måltid × 90 kr",
        quantity: 5,
        unit_price: 90,
        line_amount: 450,
        vat_rate: 0.15,
        vat_amount: 67.5,
        tax_code_id: "MVA_15",
      },
    ],
    tripletex_customers: [
      {
        provider_id: PROVIDER_ID,
        company_id: COMPANY_ID,
        tripletex_customer_id: "tx-customer-99",
      },
    ],
    lifecycle_audit_log: [],
    ...overrides,
  };
}

describe("handleAgreementInvoiceCreateProvider (TPT-B-4)", () => {
  beforeEach(() => {
    createInvoiceMock.mockReset();
    ensureProviderProductMock.mockReset();
    ensureProviderVatCodeMock.mockReset();
    resolveTripletexAuthMock.mockReset();
    resolveTripletexAuthMock.mockResolvedValue({ companyId: "1", token: "tok" });
    ensureProviderProductMock.mockResolvedValue({ productId: "prod-basis", vatCode: "15", created: false });
    ensureProviderVatCodeMock.mockResolvedValue({ vatTypeId: 15, vatCode: "15" });
  });

  test("happy path: creates Tripletex invoice, export, audit, SENT", async () => {
    const state = baseState();
    createInvoiceMock.mockResolvedValue({ externalId: "tx-inv-501", raw: {} });

    const result = await handleAgreementInvoiceCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: {
        invoice_id: INVOICE_ID,
        provider_id: PROVIDER_ID,
        agreement_id: AGREEMENT_ID,
        target: "provider",
        request_rid: "rid-1",
      },
    });

    expect(result.ok).toBe(true);
    expect(createInvoiceMock).toHaveBeenCalledTimes(1);
    expect(state.tripletex_exports).toHaveLength(1);
    expect(state.agreement_invoices[0]?.status).toBe("SENT");
    expect(state.agreement_invoices[0]?.tripletex_invoice_id).toBe("tx-inv-501");
    expect(state.lifecycle_audit_log).toHaveLength(1);
    expect(state.lifecycle_audit_log[0]?.action).toBe("agreement_provider_invoice_created");
  });

  test("idempotency: tripletex_invoice_id already set skips push", async () => {
    const state = baseState({
      agreement_invoices: [
        {
          ...baseState().agreement_invoices[0],
          status: "SENT",
          tripletex_invoice_id: "tx-already",
        },
      ],
    });

    const result = await handleAgreementInvoiceCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { target: "provider" },
    });

    expect(result.ok).toBe(true);
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  test("Tripletex 409: resolves existing id and marks SENT", async () => {
    const state = baseState();
    createInvoiceMock.mockRejectedValue(
      new TripletexClientError({
        message: "conflict",
        kind: "PERMANENT",
        code: "TRIPLETEX_CONFLICT",
        status: 409,
        detail: { value: { id: "tx-409-inv" } },
      }),
    );

    const result = await handleAgreementInvoiceCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { target: "provider" },
    });

    expect(result.ok).toBe(true);
    expect(state.agreement_invoices[0]?.tripletex_invoice_id).toBe("tx-409-inv");
    expect(state.agreement_invoices[0]?.status).toBe("SENT");
  });

  test("missing customer mapping → FAILED permanent", async () => {
    const state = baseState({ tripletex_customers: [] });

    const result = await handleAgreementInvoiceCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { target: "provider" },
    });

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.error).toBe("MISSING_CUSTOMER_MAPPING");
  });

  test("missing product mapping: ensureProviderProduct inline → success", async () => {
    const state = baseState();
    ensureProviderProductMock.mockResolvedValueOnce({ productId: "prod-new", vatCode: "15", created: true });
    createInvoiceMock.mockResolvedValue({ externalId: "tx-inv-new", raw: {} });

    const result = await handleAgreementInvoiceCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { target: "provider" },
    });

    expect(result.ok).toBe(true);
    expect(ensureProviderProductMock).toHaveBeenCalled();
  });

  test("Tripletex 503 transient → PENDING retry", async () => {
    const state = baseState();
    createInvoiceMock.mockRejectedValue(
      new TripletexClientError({
        message: "service unavailable",
        kind: "TRANSIENT",
        code: "TRIPLETEX_HTTP_ERROR",
        status: 503,
      }),
    );

    const result = await handleAgreementInvoiceCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { target: "provider" },
    });

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(false);
  });

  test("Tripletex 400 validation → FAILED permanent", async () => {
    const state = baseState();
    createInvoiceMock.mockRejectedValue(
      new TripletexClientError({
        message: "validation failed",
        kind: "PERMANENT",
        code: "TRIPLETEX_HTTP_ERROR",
        status: 400,
      }),
    );

    const result = await handleAgreementInvoiceCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { target: "provider" },
    });

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
  });

  test("auth failure: provider creds not configured → FAILED permanent", async () => {
    const state = baseState();
    resolveTripletexAuthMock.mockRejectedValue(
      new TripletexClientError({
        message: "Provider Tripletex credentials not configured",
        kind: "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
        code: "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
      }),
    );

    const result = await handleAgreementInvoiceCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { target: "provider" },
    });

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
  });
});
