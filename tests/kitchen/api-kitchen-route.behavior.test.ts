// @ts-nocheck
import { describe, test, expect, vi } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}

async function readJson(res: Response) {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

// Mock routeGuard to inject kitchen scope
vi.mock("@/lib/http/routeGuard", async () => {
  const mod = await vi.importActual<any>("@/lib/http/routeGuard");
  return {
    ...mod,
    scopeOr401: vi.fn(async () => ({
      ok: true,
      ctx: {
        rid: "rid_kitchen_api",
        route: "/api/kitchen",
        method: "GET",
        scope: {
          userId: "u1",
          role: "kitchen",
          companyId: "c1",
          locationId: "l1",
          email: "kitchen@test.lunchportalen.no",
        },
      },
    })),
  };
});

// Simple in-memory admin client for orders
function makeAdminMock(seed: { orders?: any[] }) {
  const db = {
    orders: seed.orders ?? [],
  };

  return {
    from: (table: string) => {
      let rows = (db as any)[table] ?? [];
      const state: any = { filters: [], inFilters: {} as Record<string, any[]> };

      const q: any = {
        select: () => q,
        eq: (k: string, v: any) => {
          state.filters.push({ k, v });
          rows = rows.filter((r: any) => String(r[k] ?? "") === String(v ?? ""));
          return q;
        },
        in: (k: string, vals: any[]) => {
          const set = (Array.isArray(vals) ? vals : [vals]).map(String);
          rows = rows.filter((r: any) => set.includes(String(r[k] ?? "")));
          return q;
        },
        then: (resolve: any) => {
          resolve({ data: rows, error: null });
        },
      };

      return q;
    },
  };
}

let adminDb: any;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => adminDb,
}));

import { GET as kitchenGET } from "../../app/api/kitchen/route";

describe("api/kitchen – production visibility", () => {
  test("includes only ACTIVE orders and excludes cancelled/other statuses", async () => {
    adminDb = makeAdminMock({
      orders: [
        {
          id: "o1",
          user_id: "u1",
          company_id: "c1",
          location_id: "l1",
          date: "2026-02-03",
          status: "ACTIVE",
          note: null,
        },
        {
          id: "o2",
          user_id: "u2",
          company_id: "c1",
          location_id: "l1",
          date: "2026-02-03",
          status: "active",
          note: null,
        },
        {
          id: "o3",
          user_id: "u3",
          company_id: "c1",
          location_id: "l1",
          date: "2026-02-03",
          status: "CANCELED",
          note: null,
        },
        {
          id: "o4",
          user_id: "u4",
          company_id: "c1",
          location_id: "l1",
          date: "2026-02-03",
          status: "QUEUED",
          note: null,
        },
      ],
    });

    const req = mkReq("http://localhost/api/kitchen?date=2026-02-03", { method: "GET" });
    const res = await kitchenGET(req);

    expect(res.status).toBe(200);
    const body = await readJson(res);

    expect(body?.ok).toBe(true);
    expect(body?.data?.date).toBe("2026-02-03");
    expect(body?.data?.summary?.orders).toBe(2);
    const companies = new Set((body?.data?.rows ?? []).map((r: any) => r.company));
    expect(companies.size).toBe(1);
  });

  test("fails closed when required company/location/user fields are missing", async () => {
    adminDb = makeAdminMock({
      orders: [
        {
          id: "o1",
          user_id: "u1",
          company_id: null,
          location_id: "l1",
          date: "2026-02-03",
          status: "ACTIVE",
        },
        {
          id: "o2",
          user_id: "u2",
          company_id: "c1",
          location_id: null,
          date: "2026-02-03",
          status: "ACTIVE",
        },
        {
          id: "o3",
          user_id: null,
          company_id: "c1",
          location_id: "l1",
          date: "2026-02-03",
          status: "ACTIVE",
        },
      ],
    });

    const req = mkReq("http://localhost/api/kitchen?date=2026-02-03", { method: "GET" });
    const res = await kitchenGET(req);

    expect(res.status).toBe(200);
    const body = await readJson(res);

    expect(body?.ok).toBe(true);
    expect(body?.data?.summary?.orders).toBe(0);
    expect(body?.data?.rows ?? []).toHaveLength(0);
    expect(body?.data?.reason).toBe("NO_ORDERS");
  });
});
