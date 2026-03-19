/**
 * Order create and cancel API flow: guards, validation, RPC error mapping.
 * Proves: valid create → success; invalid day/agreement → reject; cancel when allowed;
 * no 500 crash; clear error response; deterministic behavior.
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

/* ========== POST /api/orders (create/set) ========== */

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());
let rpcData: unknown = null;
let rpcError: { message?: string } | null = null;
let mockOrder: { id: string; date: string; user_id: string; company_id: string; location_id?: string; status: string } | null = null;
let mockCompanyStatus = "active";
let requireRuleResult: { ok: true } | { ok: false; status: number; error: string; message: string } = { ok: true };
let ordersCallCount = 0;

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
  readJson: vi.fn(async (req: Request) => {
    try {
      return await req.json();
    } catch {
      return {};
    }
  }),
}));

vi.mock("@/lib/agreement/requireRule", () => ({
  requireRule: vi.fn(async () => requireRuleResult),
}));

vi.mock("@/lib/cutoff", () => ({
  assertBeforeCutoffForDeliveryDate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => {
    ordersCallCount = 0;
    return {
      rpc: vi.fn(async (_name: string, _params: unknown) => ({ data: rpcData, error: rpcError })),
      auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
      from: (table: string) => {
        const chain: any = {
          select: (..._cols: string[]) => chain,
          eq: (col: string, val: string) => ({ ...chain, [col]: val }),
          maybeSingle: async () => {
            if (table === "profiles") {
              return { data: { id: "u1", role: "employee", company_id: "c1", disabled_at: null }, error: null };
            }
            if (table === "companies") {
              return { data: { id: "c1", status: mockCompanyStatus }, error: null };
            }
            if (table === "orders") {
              ordersCallCount += 1;
              const id = chain.id;
              if (!mockOrder || (id && mockOrder.id !== id)) {
                return { data: null, error: null };
              }
              if (ordersCallCount === 1) {
                return { data: mockOrder, error: null };
              }
              return {
                data: {
                  id: mockOrder.id,
                  date: mockOrder.date,
                  status: "CANCELLED",
                  updated_at: new Date().toISOString(),
                },
                error: null,
              };
            }
            return { data: null, error: null };
          },
        };
        return chain;
      },
    };
  }),
}));

import { POST as ordersRoutePOST } from "../../app/api/orders/route";

describe("Order create — POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_orders", scope: { userId: "u1", companyId: "c1", locationId: "l1", role: "employee" } },
    });
    requireRoleOr403Mock.mockReturnValue(null);
    rpcError = null;
    rpcData = [{ order_id: "ord-1", status: "ACTIVE", date: "2026-02-03", slot: "lunch", receipt: "2026-02-03T07:00:00Z" }];
  });

  test("returns 401 when not authenticated (guard enforcement)", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), { status: 401 }),
    });
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "2026-02-03", action: "place", slot: "lunch" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(401);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("valid create → 200 with orderId and status", async () => {
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "2026-02-03", action: "place", slot: "lunch" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.orderId).toBe("ord-1");
    expect(json.status).toBe("ACTIVE");
    expect(json.data?.orderId).toBe("ord-1");
  });

  test("invalid date → 400 BAD_DATE", async () => {
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "not-a-date", action: "place" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(String(json.error?.code ?? json.status)).toMatch(/BAD_DATE|400/);
  });

  test("invalid action → 400 BAD_ACTION", async () => {
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "2026-02-03", action: "invalid" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(String(json.error?.code ?? json.message)).toMatch(/BAD_ACTION|gyldig/);
  });

  test("RPC NO_ACTIVE_AGREEMENT → 409 with clear code", async () => {
    rpcError = { message: "NO_ACTIVE_AGREEMENT" };
    rpcData = null;
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "2026-02-03", action: "place", slot: "lunch" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(String(json.error?.code ?? json.error)).toBe("NO_ACTIVE_AGREEMENT");
    expect(json.message).toBeTruthy();
  });

  test("RPC OUTSIDE_DELIVERY_DAYS → 409", async () => {
    rpcError = { message: "OUTSIDE_DELIVERY_DAYS" };
    rpcData = null;
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "2026-02-03", action: "place", slot: "lunch" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(String(json.error?.code ?? json.error)).toBe("OUTSIDE_DELIVERY_DAYS");
  });

  test("RPC CUTOFF_PASSED → 409", async () => {
    rpcError = { message: "CUTOFF_PASSED" };
    rpcData = null;
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "2026-02-03", action: "place", slot: "lunch" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(String(json.error?.code ?? json.error)).toBe("CUTOFF_PASSED");
  });

  test("RPC returns empty order_id → 500 ORDER_SET_BAD_RESPONSE (no silent success)", async () => {
    rpcError = null;
    rpcData = [{ status: "ACTIVE", date: "2026-02-03" }]; // no order_id
    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "2026-02-03", action: "place", slot: "lunch" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(500);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(String(json.error?.code ?? json.error)).toMatch(/ORDER_SET_BAD_RESPONSE|500/);
  });
});

/* ========== PATCH /api/orders/[orderId]/cancel ========== */

const lpOrderCancelMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/orders/rpcWrite", () => ({
  lpOrderCancel: (...args: unknown[]) => lpOrderCancelMock(...args),
}));

// Dynamic import after mocks so route uses mocked lpOrderCancel
async function getCancelRoute() {
  const mod = await import("../../app/api/orders/[orderId]/cancel/route");
  return mod.PATCH;
}

describe("Order cancel — PATCH /api/orders/[orderId]/cancel", () => {
  const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder = {
      id: ORDER_ID,
      date: "2026-02-05",
      user_id: "u1",
      company_id: "c1",
      location_id: "l1",
      status: "ACTIVE",
    };
    mockCompanyStatus = "active";
    requireRuleResult = { ok: true };
    lpOrderCancelMock.mockResolvedValue({ ok: true, row: { id: ORDER_ID, date: "2026-02-05", status: "CANCELLED" } });
  });

  test("cancel allowed → 200 with changed: true", async () => {
    const PATCH = await getCancelRoute();
    const req = mkReq(`http://localhost/api/orders/${ORDER_ID}`, { method: "PATCH" });
    const res = await PATCH(req, { params: { orderId: ORDER_ID } });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    const payload = json.data ?? json;
    expect(payload.changed).toBe(true);
    expect(payload.order?.status).toBe("CANCELLED");
    expect(lpOrderCancelMock).toHaveBeenCalled();
  });

  test("not own order → 403", async () => {
    mockOrder = { ...mockOrder!, user_id: "other-user" };
    const PATCH = await getCancelRoute();
    const req = mkReq(`http://localhost/api/orders/${ORDER_ID}`, { method: "PATCH" });
    const res = await PATCH(req, { params: { orderId: ORDER_ID } });
    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(lpOrderCancelMock).not.toHaveBeenCalled();
  });

  test("company not active → 403", async () => {
    mockCompanyStatus = "paused";
    const PATCH = await getCancelRoute();
    const req = mkReq(`http://localhost/api/orders/${ORDER_ID}`, { method: "PATCH" });
    const res = await PATCH(req, { params: { orderId: ORDER_ID } });
    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(String(json.error ?? json.code)).toMatch(/company_blocked|forbidden/);
    expect(lpOrderCancelMock).not.toHaveBeenCalled();
  });

  test("order not found → 404", async () => {
    mockOrder = null;
    const PATCH = await getCancelRoute();
    const req = mkReq(`http://localhost/api/orders/${ORDER_ID}`, { method: "PATCH" });
    const res = await PATCH(req, { params: { orderId: ORDER_ID } });
    expect(res.status).toBe(404);
    expect(lpOrderCancelMock).not.toHaveBeenCalled();
  });
});
