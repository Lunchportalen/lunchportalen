// tests/tenant-isolation-driver.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}

let eqCalls: Array<{ table: string; key: string; value: string }> = [];
let adminConfig: {
  profile?: { company_id: string; location_id: string | null; disabled_at: null; is_active: boolean };
  companyLocations?: string[];
  orderLocations?: string[];
} = {};

vi.mock("@/lib/http/routeGuard", async () => {
  const mod = await vi.importActual<any>("@/lib/http/routeGuard");
  return {
    ...mod,
    scopeOr401: vi.fn(async () => ({
      ok: true,
      ctx: {
        rid: "rid_test",
        route: "/api/driver/stops",
        method: "GET",
        scope: {
          userId: "u1",
          role: "driver",
          companyId: "cA",
          locationId: "l1",
          email: "driver.test@lunchportalen.no",
        },
      },
    })),
  };
});

vi.mock("@/lib/date/oslo", () => ({
  osloTodayISODate: () => "2026-02-02",
  osloNowISO: () => "2026-02-02T07:30:00Z",
  isIsoDate: (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? "")),
}));

function makeAdmin() {
  const profile =
    adminConfig.profile ?? {
      company_id: "cA",
      location_id: null,
      disabled_at: null,
      is_active: true,
    };
  const companyLocations = adminConfig.companyLocations ?? ["l1"];
  const orderLocations = adminConfig.orderLocations ?? ["l1"];

  return {
    from: (table: string) => {
      const q: any = {
        _table: table,
        _eq: {},
        _in: {},
        select: () => q,
        eq: (k: string, v: any) => {
          eqCalls.push({ table, key: k, value: String(v ?? "") });
          q._eq[k] = v;
          return q;
        },
        in: (k: string, v: any) => {
          q._in[k] = Array.isArray(v) ? v : [v];
          return q;
        },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => {
          if (table === "profiles") {
            return { data: profile, error: null };
          }
          if (table === "company_locations") {
            const id = String(q._eq.id ?? "");
            if (!id) return { data: null, error: null };
            return { data: { id, company_id: profile.company_id }, error: null };
          }
          return { data: null, error: null };
        },
        upsert: (payload: any) => ({
          select: () => ({
            maybeSingle: async () => ({
              data: { ...payload, id: "x1", packed_at: payload?.packed_at ?? null, delivered_at: payload?.delivered_at ?? null },
              error: null,
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => ({
              then: (resolve: any) => resolve({ count: 0, error: null }),
            }),
          }),
        }),
        then: (resolve: any) => {
          if (table === "company_locations") {
            const ids = q._in.id ?? [];
            const rows = companyLocations.filter((id: string) => ids.includes(id)).map((id: string) => ({ id, company_id: profile.company_id }));
            return resolve({ data: rows, error: null });
          }
          if (table === "orders") {
            const rows = orderLocations.map((id: string) => ({ location_id: id }));
            return resolve({ data: rows, error: null });
          }
          return resolve({ data: [], error: null });
        },
      };
      return q;
    },
  };
}

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => makeAdmin(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "driver.test@lunchportalen.no" } }, error: null }) },
    from: makeAdmin().from,
  }),
}));

import { GET as driverStopsGET } from "../app/api/driver/stops/route";
import { POST as driverConfirmPOST } from "../app/api/driver/confirm/route";
import { GET as driverCsvGET } from "../app/driver/csv/route";
import { POST as driverBulkSetPOST } from "../app/api/driver/bulk-set/route";

beforeEach(() => {
  eqCalls = [];
  adminConfig = {};
});

describe("tenant isolation � driver stops", () => {
  test("orders and confirmations are filtered by company_id", async () => {
    const req = mkReq("http://localhost/api/driver/stops?date=2026-02-02", { method: "GET" });
    const res = await driverStopsGET(req);
    expect(res.status).toBe(200);

    const ordersCompany = eqCalls.find((c) => c.table === "orders" && c.key === "company_id");
    const confCompany = eqCalls.find((c) => c.table === "delivery_confirmations" && c.key === "company_id");

    expect(ordersCompany?.value).toBe("cA");
    expect(confCompany?.value).toBe("cA");
  });
});

describe("driver isolation � confirm/csv/bulk-set", () => {
  test("driver cannot mark other company stop", async () => {
    const req = mkReq("http://localhost/api/driver/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", companyId: "cB", locationId: "l1" }),
    });
    const res = await driverConfirmPOST(req);
    expect(res.status).toBe(403);
  });

  test("driver cannot fetch CSV for other date", async () => {
    const req = mkReq("http://localhost/driver/csv?date=2026-02-01&window=lunch", { method: "GET" });
    const res = await driverCsvGET(req);
    expect(res.status).toBe(403);
  });

  test("bulk-set rejects non-delivered status", async () => {
    const req = mkReq("http://localhost/api/driver/bulk-set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", status: "PACKED", locationIds: ["l1"] }),
    });
    const res = await driverBulkSetPOST(req);
    expect(res.status).toBe(403);
  });

  test("bulk-set rejects non-today date", async () => {
    const req = mkReq("http://localhost/api/driver/bulk-set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-01", slot: "lunch", status: "DELIVERED", locationIds: ["l1"] }),
    });
    const res = await driverBulkSetPOST(req);
    expect(res.status).toBe(403);
  });

  test("bulk-set requires locations to be in today's stops", async () => {
    adminConfig.companyLocations = ["l1"];
    adminConfig.orderLocations = ["l1"];
    const req = mkReq("http://localhost/api/driver/bulk-set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", status: "DELIVERED", locationIds: ["l2"] }),
    });
    const res = await driverBulkSetPOST(req);
    expect(res.status).toBe(403);
  });
});


