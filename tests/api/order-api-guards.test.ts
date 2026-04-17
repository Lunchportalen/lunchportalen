/**
 * Order API guards: auth and required headers.
 * Proves unauthenticated and invalid request fail safely (no 500, no silent success).
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

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

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const readJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agreement/requireRule", () => ({
  requireRule: vi.fn(async () => ({
    ok: true,
    rule: {
      company_id: "c1",
      day_key: "tue",
      slot: "lunch",
      tier: "BASIS",
    },
  })),
}));

vi.mock("@/lib/http/routeGuard", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/http/routeGuard")>();
  return {
    ...orig,
    scopeOr401: scopeOr401Mock,
    requireRoleOr403: vi.fn(() => null),
    requireCompanyScopeOr403: vi.fn(() => null),
    readJson: readJsonMock,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "closed_dates") {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                or: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  }),
}));

// Avoid hitting real RPC/idempotency in guard tests
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(() => Promise.resolve({ rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
}));

import { POST as ordersUpsertPOST } from "../../app/api/orders/upsert/route";
import { POST as ordersRoutePOST } from "../../app/api/orders/route";
import { POST as ordersCancelPOST } from "../../app/api/orders/cancel/route";

const authCtx = {
  rid: "rid_test",
  ctx: {
    rid: "rid_test",
    scope: { userId: "u1", companyId: "c1", locationId: "l1", role: "employee", email: "emp@test.no" },
  },
};

describe("Order API guards — orders/upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readJsonMock.mockResolvedValue({});
  });

  test("returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), { status: 401 }),
    });

    const req = mkReq("http://localhost/api/orders/upsert", {
      method: "POST",
      headers: { "Idempotency-Key": "test-key-min-8-chars" },
      body: { date: "2026-02-03", slot: "lunch" },
    });
    const res = await ordersUpsertPOST(req);
    expect(res.status).toBe(401);
    const json = await readJson(res);
    expect(json?.ok).toBe(false);
  });

  test("returns 400 when Idempotency-Key header is missing or too short", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: authCtx.ctx,
    });

    const req = mkReq("http://localhost/api/orders/upsert", {
      method: "POST",
      body: { date: "2026-02-03", slot: "lunch" },
    });
    const res = await ordersUpsertPOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json?.ok).toBe(false);
    expect(String(json?.error)).toBe("IDEMPOTENCY_REQUIRED");
  });
});

describe("Order API guards — orders create (POST /api/orders)", () => {
  const supabaseServerMod = () => import("@/lib/supabase/server");

  beforeEach(() => {
    vi.clearAllMocks();
    readJsonMock.mockResolvedValue({});
  });

  afterEach(async () => {
    const { supabaseServer } = await supabaseServerMod();
    vi.mocked(supabaseServer).mockImplementation(async () => ({
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    }));
  });

  test("returns 401 when not authenticated (canonical res/response)", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, message: "Ikke innlogget." }), { status: 401 }),
      response: new Response(JSON.stringify({ ok: false, message: "Ikke innlogget." }), { status: 401 }),
    });

    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "2026-02-03", action: "SET" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(401);
    const json = await readJson(res);
    expect(json?.ok).toBe(false);
  });

  test("returns 400 when date is invalid", async () => {
    scopeOr401Mock.mockResolvedValue({ ok: true, ctx: authCtx.ctx });
    readJsonMock.mockResolvedValueOnce({ date: "not-a-date", action: "SET" });

    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "not-a-date", action: "SET" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json?.ok).toBe(false);
    expect(String(json?.code)).toBe("BAD_DATE");
  });

  test("returns 200 with orderId when RPC succeeds", async () => {
    scopeOr401Mock.mockResolvedValue({ ok: true, ctx: authCtx.ctx });
    readJsonMock.mockResolvedValueOnce({ date: "2026-02-03", action: "SET" });
    const { supabaseServer } = await supabaseServerMod();
    const rpcOk = vi.fn().mockResolvedValueOnce({
      data: { order_id: "ord-1", status: "ACTIVE", date: "2026-02-03", slot: "lunch", receipt: "2026-02-03T12:00:00Z" },
      error: null,
    });
    vi.mocked(supabaseServer).mockImplementation(async () => ({
      rpc: rpcOk,
      from: (table: string) => {
        const chain: any = {
          select: () => chain,
          limit: () => chain,
          eq: () => chain,
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
            if (table === "companies") {
              return {
                data: { billing_hold: false, billing_hold_reason: null, status: "ACTIVE" },
                error: null,
              };
            }
            return { data: null, error: null };
          },
        };
        return chain;
      },
    }));

    const req = mkReq("http://localhost/api/orders", {
      method: "POST",
      body: { date: "2026-02-03", action: "SET" },
    });
    const res = await ordersRoutePOST(req);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json?.ok).toBe(true);
    expect(json?.orderId).toBe("ord-1");
    expect(json?.status).toBe("active");
  });
});

describe("Order API guards — orders cancel (POST /api/orders/cancel)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, message: "Ikke innlogget." }), { status: 401 }),
    });

    const req = mkReq("http://localhost/api/orders/cancel", {
      method: "POST",
      body: { date: "2026-02-03" },
    });
    const res = await ordersCancelPOST(req);
    expect(res.status).toBe(401);
    const json = await readJson(res);
    expect(json?.ok).toBe(false);
  });
});
