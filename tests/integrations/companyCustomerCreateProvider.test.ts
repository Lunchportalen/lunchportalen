import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  ensureCompanyCustomerMock,
  TripletexClientError,
} = vi.hoisted(() => {
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
    ensureCompanyCustomerMock: vi.fn(),
    TripletexClientError,
  };
});

vi.mock("@/lib/integrations/tripletex/client", () => ({
  ensureCompanyCustomer: (...args: unknown[]) => ensureCompanyCustomerMock(...args),
  classifyTripletexError: (error: unknown) => error,
  TripletexClientError,
}));

import { handleCompanyCustomerCreateProvider } from "@/lib/integrations/tripletex/companyCustomerSync";

const COMPANY_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROVIDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EVENT_KEY = `tripletex.company_customer_create_provider:${COMPANY_ID}:${PROVIDER_ID}`;

type TableState = {
  tripletex_customers: Array<Record<string, unknown>>;
  companies: Array<Record<string, unknown>>;
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
      insert: async (row: Record<string, unknown>) => {
        state[table].push(row);
        return { error: null };
      },
      upsert: async () => ({ error: null }),
    };

    rows = state[table];
    return api;
  };

  return {
    from: (table: string) => chain(table as keyof TableState),
  };
}

const companyRow = {
  id: COMPANY_ID,
  provider_id: PROVIDER_ID,
  orgnr: "123456789",
  name: "Test Co",
  legal_name: "Test Co AS",
  billing_email: "billing@test.no",
  billing_address: "Gate 1",
  billing_postcode: "7030",
  billing_city: "Trondheim",
  billing_country: "NO",
  ehf_enabled: false,
  ehf_endpoint: null,
};

describe("handleCompanyCustomerCreateProvider (TPT-B-2)", () => {
  beforeEach(() => {
    ensureCompanyCustomerMock.mockReset();
  });

  test("happy path: PENDING event → mapping created + audit", async () => {
    const state: TableState = {
      tripletex_customers: [],
      companies: [companyRow],
      lifecycle_audit_log: [],
    };

    ensureCompanyCustomerMock.mockResolvedValueOnce({ customerId: "9001", created: true });

    const result = await handleCompanyCustomerCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { company_id: COMPANY_ID, provider_id: PROVIDER_ID, env: "test", request_rid: "rid-1" },
    });

    expect(result).toEqual({ ok: true });
    expect(ensureCompanyCustomerMock).toHaveBeenCalledTimes(1);
    expect(state.lifecycle_audit_log).toHaveLength(1);
    expect(state.lifecycle_audit_log[0]?.action).toBe("company_provider_customer_created");
  });

  test("idempotency: existing mapping → ok without Tripletex call", async () => {
    const state: TableState = {
      tripletex_customers: [
        { company_id: COMPANY_ID, provider_id: PROVIDER_ID, tripletex_customer_id: "9001" },
      ],
      companies: [companyRow],
      lifecycle_audit_log: [],
    };

    const result = await handleCompanyCustomerCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { company_id: COMPANY_ID, provider_id: PROVIDER_ID },
    });

    expect(result).toEqual({ ok: true });
    expect(ensureCompanyCustomerMock).not.toHaveBeenCalled();
  });

  test("409 path delegated to ensureCompanyCustomer (success)", async () => {
    const state: TableState = {
      tripletex_customers: [],
      companies: [companyRow],
      lifecycle_audit_log: [],
    };

    ensureCompanyCustomerMock.mockResolvedValueOnce({ customerId: "9001", created: false });

    const result = await handleCompanyCustomerCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { company_id: COMPANY_ID, provider_id: PROVIDER_ID, env: "prod" },
    });

    expect(result).toEqual({ ok: true });
  });

  test("provider creds not configured: permanent failure", async () => {
    const state: TableState = {
      tripletex_customers: [],
      companies: [companyRow],
      lifecycle_audit_log: [],
    };

    ensureCompanyCustomerMock.mockRejectedValueOnce(
      new TripletexClientError({
        message: "Provider Tripletex credentials not configured",
        kind: "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
        code: "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
      }),
    );

    const result = await handleCompanyCustomerCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { company_id: COMPANY_ID, provider_id: PROVIDER_ID },
    });

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
  });

  test("transient Tripletex 500: retry (not permanent)", async () => {
    const state: TableState = {
      tripletex_customers: [],
      companies: [companyRow],
      lifecycle_audit_log: [],
    };

    ensureCompanyCustomerMock.mockRejectedValueOnce(
      new TripletexClientError({
        message: "Tripletex network error",
        kind: "TRANSIENT",
        code: "TRIPLETEX_NETWORK_ERROR",
      }),
    );

    const result = await handleCompanyCustomerCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { company_id: COMPANY_ID, provider_id: PROVIDER_ID },
    });

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(false);
  });

  test("missing company: permanent COMPANY_NOT_FOUND", async () => {
    const state: TableState = {
      tripletex_customers: [],
      companies: [],
      lifecycle_audit_log: [],
    };

    const result = await handleCompanyCustomerCreateProvider(createAdminMock(state), {
      event_key: EVENT_KEY,
      payload: { company_id: COMPANY_ID, provider_id: PROVIDER_ID },
    });

    expect(result).toEqual({ ok: false, permanent: true, error: "COMPANY_NOT_FOUND" });
  });
});

describe("ensureProviderProduct exports (TPT-B-2)", () => {
  test("client module exports provider-scoped helpers", async () => {
    const mod = await vi.importActual<typeof import("@/lib/integrations/tripletex/client")>(
      "@/lib/integrations/tripletex/client",
    );
    expect(typeof mod.ensureProviderProduct).toBe("function");
    expect(typeof mod.ensureProviderVatCode).toBe("function");
    expect(typeof mod.ensureCompanyCustomer).toBe("function");
  });
});
