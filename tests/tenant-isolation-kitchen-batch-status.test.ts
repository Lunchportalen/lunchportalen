// tests/tenant-isolation-kitchen-batch-status.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

const COMPANY_A = "11111111-1111-1111-1111-111111111111";
const COMPANY_B = "22222222-2222-2222-2222-222222222222";
const LOC_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LOC_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ORDER_A = "33333333-3333-3333-3333-333333333333";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}

vi.mock("@/lib/http/routeGuard", async () => {
  const mod = await vi.importActual<any>("@/lib/http/routeGuard");
  return {
    ...mod,
    scopeOr401: vi.fn(async () => ({
      ok: true,
      ctx: {
        rid: "rid_test",
        route: "/api/kitchen/orders/batch-status",
        method: "POST",
        scope: {
          userId: "u1",
          role: "kitchen",
          companyId: "cA",
          locationId: "l1",
          email: "kitchen@lunchportalen.no",
        },
      },
    })),
  };
});

vi.mock("@/lib/date/oslo", () => ({
  osloNowISO: () => "2026-02-02T07:30:00Z",
  osloTodayISODate: () => "2026-02-02",
  cutoffStatusForDate0805: () => "TODAY_LOCKED",
}));

function makeAdminMock(seed?: {
  profiles?: any[];
  company_locations?: any[];
  kitchen_batch?: any[];
  orders?: any[];
  company_current_agreement?: any[];
}) {
  const db = {
    profiles: seed?.profiles ?? [],
    company_locations: seed?.company_locations ?? [],
    kitchen_batch: seed?.kitchen_batch ?? [],
    orders: seed?.orders ?? [],
    company_current_agreement: seed?.company_current_agreement ?? [],
  };

  function applyFilters(rows: any[], filters: Array<{ k: string; v: any }>, inFilters: Record<string, any[]>) {
    return rows.filter((r) => {
      for (const f of filters) {
        if (String((r as any)?.[f.k] ?? "") !== String(f.v ?? "")) return false;
      }
      for (const [k, vals] of Object.entries(inFilters)) {
        if (!vals.map(String).includes(String((r as any)?.[k] ?? ""))) return false;
      }
      return true;
    });
  }

  return {
    from: (table: string) => {
      const state: any = { table, filters: [], inFilters: {}, limit: null, writeKind: null, writePayload: null };
      const q: any = {
        select: () => q,
        eq: (k: string, v: any) => {
          state.filters.push({ k, v });
          return q;
        },
        in: (k: string, v: any) => {
          state.inFilters[k] = Array.isArray(v) ? v : [v];
          return q;
        },
        limit: (n: number) => {
          state.limit = n;
          return q;
        },
        maybeSingle: async () => {
          if (state.writeKind === "insert" && table === "kitchen_batch") {
            db.kitchen_batch.push({ ...state.writePayload });
            return { data: state.writePayload, error: null };
          }

          const rows = applyFilters(db[table as keyof typeof db] ?? [], state.filters, state.inFilters);
          return { data: rows[0] ?? null, error: null };
        },
        insert: (payload: any) => {
          state.writeKind = "insert";
          state.writePayload = payload;
          return q;
        },
        update: () => ({ in: () => ({ select: () => ({ then: (resolve: any) => resolve({ data: [], error: null }) }) }) }),
        then: (resolve: any) => {
          const rows = applyFilters(db[table as keyof typeof db] ?? [], state.filters, state.inFilters);
          const out = state.limit ? rows.slice(0, state.limit) : rows;
          resolve({ data: out, error: null });
        },
      };
      return q;
    },
  };
}

let adminDb: any;

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => adminDb,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
    },
  }),
}));

import { GET as batchStatusGET, POST as batchStatusPOST } from "../app/api/kitchen/orders/batch-status/route";
import { GET as batchGetGET } from "../app/api/kitchen/batch/get/route";
import { GET as batchListGET } from "../app/api/kitchen/batch/list/route";
import { POST as batchStartPOST } from "../app/api/kitchen/batch/start/route";

beforeEach(() => {
  adminDb = makeAdminMock({
    profiles: [{ id: "p1", user_id: "u1", company_id: COMPANY_A, location_id: null, disabled_at: null, is_active: true }],
    company_locations: [
      { id: LOC_A, company_id: COMPANY_A },
      { id: LOC_B, company_id: COMPANY_B },
    ],
    orders: [{ id: ORDER_A, company_id: COMPANY_A, location_id: LOC_A, date: "2026-02-02", status: "ACTIVE", slot: "lunch" }],
    company_current_agreement: [{ id: "a1", company_id: COMPANY_A, status: "ACTIVE" }],
    kitchen_batch: [],
  });
});

describe("kitchen batch-status – tenant/date locks", () => {
  test("GET rejects companyId mismatch", async () => {
    const req = mkReq(`http://localhost/api/kitchen/orders/batch-status?date=2026-02-02&companyId=${COMPANY_B}`, { method: "GET" });
    const res = await batchStatusGET(req);
    expect(res.status).toBe(403);
  });

  test("POST rejects non-today date for kitchen", async () => {
    const req = mkReq("http://localhost/api/kitchen/orders/batch-status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-01", status: "PACKED", companyId: COMPANY_A }),
    });
    const res = await batchStatusPOST(req);
    expect(res.status).toBe(403);
  });
});

describe("kitchen batch – tenant isolation", () => {
  test("batch/get rejects other tenant location", async () => {
    const req = mkReq(`http://localhost/api/kitchen/batch/get?date=2026-02-02&slot=lunch&location_id=${LOC_B}`, { method: "GET" });
    const res = await batchGetGET(req);
    expect(res.status).toBe(403);
  });

  test("batch/list rejects other tenant location", async () => {
    const req = mkReq(`http://localhost/api/kitchen/batch/list?date=2026-02-02&location_id=${LOC_B}`, { method: "GET" });
    const res = await batchListGET(req);
    expect(res.status).toBe(403);
  });

  test("batch/start rejects other tenant location", async () => {
    const req = mkReq("http://localhost/api/kitchen/batch/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", location_id: LOC_B }),
    });
    const res = await batchStartPOST(req);
    expect(res.status).toBe(403);
  });
});

