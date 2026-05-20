import { beforeEach, describe, expect, test, vi } from "vitest";

const { ensureProviderCustomerMock, resolveTripletexAuthMock, TripletexClientError } = vi.hoisted(() => {
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
    ensureProviderCustomerMock: vi.fn(),
    resolveTripletexAuthMock: vi.fn(),
    TripletexClientError,
  };
});

vi.mock("@/lib/integrations/tripletex/client", () => ({
  ensureProviderCustomer: (...args: unknown[]) => ensureProviderCustomerMock(...args),
  resolveTripletexAuth: (...args: unknown[]) => resolveTripletexAuthMock(...args),
  classifyTripletexError: (error: unknown) => error,
  TripletexClientError,
}));

import { handleProviderCustomerCreateLp } from "@/lib/integrations/tripletex/providerCustomerSync";

const PROVIDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EVENT_KEY = `tripletex.provider_customer_create_lp:${PROVIDER_ID}`;

type TableState = {
  tripletex_customers: Array<Record<string, unknown>>;
  providers: Array<Record<string, unknown>>;
  provider_subscriptions: Array<Record<string, unknown>>;
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
      order: () => api,
      limit: () => api,
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

function baseState(overrides?: Partial<TableState>): TableState {
  return {
    tripletex_customers: [],
    providers: [
      {
        id: PROVIDER_ID,
        name: "Test Provider AS",
        org_number: "123456789",
        contact_email: "billing@test.no",
      },
    ],
    provider_subscriptions: [],
    lifecycle_audit_log: [],
    ...overrides,
  };
}

describe("handleProviderCustomerCreateLp (TPT-A-3)", () => {
  beforeEach(() => {
    ensureProviderCustomerMock.mockReset();
    resolveTripletexAuthMock.mockReset();
    resolveTripletexAuthMock.mockResolvedValue({ companyId: "1", token: "tok" });
  });

  test("happy path: creates mapping, audit log, returns ok", async () => {
    const state = baseState();
    ensureProviderCustomerMock.mockResolvedValue({ customerId: "tx-100", created: true });

    const result = await handleProviderCustomerCreateLp(
      createAdminMock(state),
      {
        event_key: EVENT_KEY,
        payload: { provider_id: PROVIDER_ID, target: "lp", request_rid: "rid-1" },
      },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(true);
    expect(ensureProviderCustomerMock).toHaveBeenCalledTimes(1);
    expect(state.lifecycle_audit_log).toHaveLength(1);
    expect(state.lifecycle_audit_log[0]?.action).toBe("provider_customer_created");
    expect(state.lifecycle_audit_log[0]?.entity_type).toBe("tripletex_sync");
  });

  test("idempotency: existing mapping skips Tripletex call", async () => {
    const state = baseState({
      tripletex_customers: [
        {
          provider_id: PROVIDER_ID,
          company_id: null,
          tripletex_customer_id: "tx-existing",
        },
      ],
    });

    const result = await handleProviderCustomerCreateLp(
      createAdminMock(state),
      { event_key: EVENT_KEY, payload: { provider_id: PROVIDER_ID, target: "lp" } },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(true);
    expect(ensureProviderCustomerMock).not.toHaveBeenCalled();
    expect(state.lifecycle_audit_log).toHaveLength(0);
  });

  test("Tripletex 409: ensureProviderCustomer resolves conflict as success", async () => {
    const state = baseState();
    ensureProviderCustomerMock.mockResolvedValue({ customerId: "tx-409", created: false });

    const result = await handleProviderCustomerCreateLp(
      createAdminMock(state),
      { event_key: EVENT_KEY, payload: { provider_id: PROVIDER_ID, target: "lp" } },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(true);
    expect(state.lifecycle_audit_log[0]?.metadata).toMatchObject({
      tripletex_customer_id: "tx-409",
    });
  });

  test("Tripletex 500: transient failure for retry", async () => {
    const state = baseState();
    ensureProviderCustomerMock.mockRejectedValue(
      new TripletexClientError({
        message: "server error",
        kind: "TRANSIENT",
        code: "TRIPLETEX_REQUEST_FAILED",
        status: 500,
      }),
    );

    const result = await handleProviderCustomerCreateLp(
      createAdminMock(state),
      { event_key: EVENT_KEY, payload: { provider_id: PROVIDER_ID, target: "lp" } },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(false);
    expect(state.lifecycle_audit_log).toHaveLength(0);
  });

  test("provider not found: permanent failure", async () => {
    const state = baseState({ providers: [] });

    const result = await handleProviderCustomerCreateLp(
      createAdminMock(state),
      { event_key: EVENT_KEY, payload: { provider_id: PROVIDER_ID, target: "lp" } },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.error).toBe("PROVIDER_NOT_FOUND");
  });

  test("invalid payload: missing provider_id", async () => {
    const state = baseState();

    const result = await handleProviderCustomerCreateLp(
      createAdminMock(state),
      { event_key: "tripletex.provider_customer_create_lp:", payload: { target: "lp" } },
      async () => ({ companyId: "1", token: "tok" }),
    );

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.error).toBe("INVALID_PAYLOAD");
  });
});
