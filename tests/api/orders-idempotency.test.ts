/**
 * POST /api/orders — valgfri Idempotency-Key + lp_idem_* + 23505→DUPLICATE_ORDER.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string>; body?: unknown }) {
  const { headers = {}, body, ...rest } = init ?? {};
  const opts: RequestInit = { ...rest, headers: { ...headers, "content-type": "application/json" } as HeadersInit };
  if (body !== undefined) opts.body = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(url, opts) as any;
}

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

const validPlaceBody = {
  date: "2026-02-03",
  action: "place",
  slot: "lunch",
  choice_key: "varmmat",
};

let scopeOr401Result = {
  ok: true,
  ctx: {
    rid: "rid_orders",
    route: "/api/orders",
    method: "POST",
    scope: { userId: "u1", companyId: "c1", locationId: "l1", role: "employee", email: "emp@test.no" },
  },
};

/** RPC-kall i rekkefølge (kun dispatch-mock). */
let rpcCalls: Array<{ name: string; args: unknown }> = [];
let idemBeginResult: { data: unknown; error: unknown } = { data: { hit: false }, error: null };
let idemOrderSetResult: { data: unknown; error: unknown } = {
  data: [{ order_id: "ord-1", status: "ACTIVE", date: "2026-02-03", slot: "lunch" }],
  error: null,
};

let mockCompanyStatus = "active";
let ordersCallCount = 0;

vi.mock("@/lib/http/routeGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/routeGuard")>();
  return {
    ...actual,
    scopeOr401: async () => scopeOr401Result,
    requireRoleOr403: () => null,
    readJson: async (req: Request) => {
      try {
        return await req.json();
      } catch {
        return {};
      }
    },
  };
});

vi.mock("@/lib/agreement/requireRule", () => ({
  requireRule: async () => ({ ok: true }),
}));

vi.mock("@/lib/cutoff", () => ({
  assertBeforeCutoffForDeliveryDate: vi.fn(),
}));

vi.mock("@/lib/system/enforcement", () => ({
  enforceSystemGate: async () => {},
}));

vi.mock("@/lib/orders/companyOrderEligibility", () => ({
  assertCompanyOrderWriteAllowed: async () => ({ ok: true }),
}));

vi.mock("@/lib/auth/agreementStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/agreementStatus")>();
  return {
    ...actual,
    getAgreementStatus: async () => ({
      agreementId: "ag_1",
      tier: "BASIS",
      dayTiers: { mon: "BASIS", tue: "BASIS", wed: "BASIS", thu: "BASIS", fri: "BASIS" },
      status: "ACTIVE",
      isActive: true,
      billingHold: false,
    }),
  };
});

vi.mock("@/lib/orders/orderWriteGuard", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/orders/orderWriteGuard")>();
  return {
    ...orig,
    assertOrderWithinAgreementPreflight: async () => ({ ok: true as const }),
  };
});

vi.mock("@/lib/orders/resolveOrderDayItemPersist", () => ({
  resolveOrderDayItemPersist: async () => ({
    ok: true as const,
    item_key: "menu-item-test",
    item_title_snapshot: "Testrett",
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      upsert: async () => ({ error: null }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { line_total: 0 }, error: null }),
        }),
      }),
      insert: async () => ({ error: null }),
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      if (name === "lp_idem_begin") return idemBeginResult;
      if (name === "lp_idem_complete") return { data: null, error: null };
      if (name === "lp_idem_fail") return { data: null, error: null };
      if (name === "lp_order_set") return idemOrderSetResult;
      return { data: null, error: { message: `unknown rpc ${name}` } };
    },
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: (table: string) => {
      const chain: any = {
        select: (..._cols: string[]) => chain,
        limit: () => chain,
        eq: (col: string, val: string) => ({ ...chain, [col]: val }),
        maybeSingle: async () => {
          if (table === "system_settings") {
            return {
              data: {
                toggles: {},
                killswitch: {},
                retention: {},
                updated_at: null,
                updated_by: null,
              },
              error: null,
            };
          }
          if (table === "profiles") {
            return { data: { id: "u1", role: "employee", company_id: "c1", disabled_at: null }, error: null };
          }
          if (table === "companies") {
            return { data: { id: "c1", status: mockCompanyStatus }, error: null };
          }
          if (table === "orders") {
            ordersCallCount += 1;
            return { data: null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  }),
}));

import { POST as ordersRoutePOST } from "../../app/api/orders/route";

describe("/api/orders POST — HTTP-idempotency", () => {
  beforeEach(async () => {
    const { invalidateSettingsCache } = await import("@/lib/settings/cache");
    invalidateSettingsCache();
    rpcCalls = [];
    idemBeginResult = { data: { hit: false }, error: null };
    idemOrderSetResult = {
      data: [{ order_id: "ord-1", status: "ACTIVE", date: "2026-02-03", slot: "lunch" }],
      error: null,
    };
    ordersCallCount = 0;
    scopeOr401Result = {
      ok: true,
      ctx: {
        rid: "rid_orders",
        route: "/api/orders",
        method: "POST",
        scope: { userId: "u1", companyId: "c1", locationId: "l1", role: "employee", email: "emp@test.no" },
      },
    };
  });

  test("uten Idempotency-Key: ingen lp_idem_*-kall, kun lp_order_set", async () => {
    const req = mkReq("http://localhost/api/orders", { method: "POST", body: validPlaceBody });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(200);
    const names = rpcCalls.map((c) => c.name);
    expect(names.filter((n) => n.startsWith("lp_idem"))).toEqual([]);
    expect(names.filter((n) => n === "lp_order_set").length).toBe(1);
  });

  test("med Idempotency-Key første gang: begin → lp_order_set → complete", async () => {
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      headers: { "Idempotency-Key": "idem-first-12345678" },
      body: validPlaceBody,
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(200);
    expect(rpcCalls.map((c) => c.name)).toEqual(["lp_idem_begin", "lp_order_set", "lp_idem_complete"]);
    const begin = rpcCalls[0];
    expect(begin.args).toMatchObject({
      p_scope: "orders.write",
      p_key: "idem-first-12345678",
      p_ttl_seconds: 300,
    });
    expect(typeof (begin.args as any).p_request_hash).toBe("string");
    expect((begin.args as any).p_request_hash.length).toBe(64);
  });

  test("samme nøkkel + cache-hit: ingen lp_order_set, returnerer lagret body og status_code", async () => {
    const cachedBody = {
      ok: true,
      rid: "rid_cached",
      orderId: "ord-cached",
      status: "active",
      date: "2026-02-03",
      timestamp: "2026-02-03T10:00:00.000Z",
      slot: "lunch",
      tier: "BASIS",
    };
    idemBeginResult = {
      data: { hit: true, response: cachedBody, status_code: 201 },
      error: null,
    };
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      headers: { "Idempotency-Key": "idem-replay-12345678" },
      body: validPlaceBody,
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(201);
    const json = await readJson(res);
    expect(json.orderId).toBe("ord-cached");
    expect(rpcCalls.map((c) => c.name)).toEqual(["lp_idem_begin"]);
  });

  test("samme nøkkel + annen hash: 400 IDEMPOTENCY_KEY_REUSE", async () => {
    idemBeginResult = {
      data: null,
      error: { code: "23514", message: "idempotency hash mismatch for scope=orders.write key=idem-reuse-12345678" },
    };
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      headers: { "Idempotency-Key": "idem-reuse-12345678" },
      body: validPlaceBody,
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.code).toBe("IDEMPOTENCY_KEY_REUSE");
  });

  test("nøkkel under 8 tegn: 400 IDEMPOTENCY_KEY_TOO_SHORT", async () => {
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      headers: { "Idempotency-Key": "short" },
      body: validPlaceBody,
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.code).toBe("IDEMPOTENCY_KEY_TOO_SHORT");
    expect(rpcCalls.length).toBe(0);
  });

  test("23505 fra lp_order_set uten header: 409 DUPLICATE_ORDER, ingen idem_fail", async () => {
    idemOrderSetResult = { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
    const req = mkReq("http://localhost/api/orders", { method: "POST", body: validPlaceBody });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(json.code).toBe("DUPLICATE_ORDER");
    expect(rpcCalls.map((c) => c.name)).toEqual(["lp_order_set"]);
    expect(rpcCalls.some((c) => c.name === "lp_idem_fail")).toBe(false);
  });

  test("23505 med Idempotency-Key: 409 DUPLICATE_ORDER + lp_idem_fail", async () => {
    idemOrderSetResult = { data: null, error: { code: "23505", message: "duplicate key" } };
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      headers: { "Idempotency-Key": "idem-dup-123456789" },
      body: validPlaceBody,
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(json.code).toBe("DUPLICATE_ORDER");
    expect(rpcCalls.map((c) => c.name)).toEqual(["lp_idem_begin", "lp_order_set", "lp_idem_fail"]);
  });

  test("IN_PROGRESS race: 409 IDEMPOTENT_IN_PROGRESS", async () => {
    idemBeginResult = {
      data: null,
      error: { code: "23514", message: "idempotency in progress for scope=orders.write key=idem-race-12345678" },
    };
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      headers: { "Idempotency-Key": "idem-race-12345678" },
      body: validPlaceBody,
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(json.code).toBe("IDEMPOTENT_IN_PROGRESS");
  });

  test("replay uten status_code i cache bruker 200 fallback", async () => {
    idemBeginResult = {
      data: {
        hit: true,
        response: { ok: true, rid: "r", orderId: "o", status: "active", date: "2026-02-03", timestamp: "t", slot: "lunch" },
      },
      error: null,
    };
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      headers: { "Idempotency-Key": "idem-fallback-12345678" },
      body: validPlaceBody,
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(200);
  });
});
