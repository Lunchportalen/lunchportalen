// tests/kitchen-batch-summary.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "22222222-2222-2222-2222-222222222222";
const LOCATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

let mockRole = "kitchen";

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
        route: "/api/kitchen/batch/summary",
        method: "GET",
        scope: {
          userId: "u1",
          role: mockRole,
          companyId: null,
          locationId: null,
          email: "kitchen@lunchportalen.no",
        },
      },
    })),
  };
});

vi.mock("@/lib/date/oslo", () => ({
  osloTodayISODate: () => "2026-02-02",
  osloNowISO: () => "2026-02-02T08:10:00",
  isIsoDate: (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")),
}));

function makeAdminMock(seed?: {
  profiles?: any[];
  company_locations?: any[];
  kitchen_batch?: any[];
  orders?: any[];
}) {
  const db = {
    profiles: seed?.profiles ?? [],
    company_locations: seed?.company_locations ?? [],
    kitchen_batch: seed?.kitchen_batch ?? [],
    orders: seed?.orders ?? [],
  };

  function applyFilters(rows: any[], filters: Array<{ k: string; v: any }>, inFilters: Record<string, any[]>, isFilters: Array<{ k: string; v: any }>) {
    return rows.filter((r) => {
      for (const f of filters) {
        if (String((r as any)?.[f.k] ?? "") !== String(f.v ?? "")) return false;
      }
      for (const [k, vals] of Object.entries(inFilters)) {
        if (!vals.map(String).includes(String((r as any)?.[k] ?? ""))) return false;
      }
      for (const f of isFilters) {
        if (f.v === null && (r as any)?.[f.k] !== null && (r as any)?.[f.k] !== undefined) return false;
      }
      return true;
    });
  }

  return {
    from: (table: string) => {
      const state: any = { table, filters: [], inFilters: {}, isFilters: [] };
      const q: any = {
        select: () => q,
        eq: (k: string, v: any) => {
          state.filters.push({ k, v });
          return q;
        },
        is: (k: string, v: any) => {
          state.isFilters.push({ k, v });
          return q;
        },
        in: (k: string, v: any) => {
          state.inFilters[k] = Array.isArray(v) ? v : [v];
          return q;
        },
        update: () => {
          throw new Error("summary must be read-only");
        },
        maybeSingle: async () => {
          const rows = applyFilters(db[table as keyof typeof db] ?? [], state.filters, state.inFilters, state.isFilters);
          return { data: rows[0] ?? null, error: null };
        },
        then: (resolve: any) => {
          const rows = applyFilters(db[table as keyof typeof db] ?? [], state.filters, state.inFilters, state.isFilters);
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

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
    },
  }),
}));

import { GET as batchSummaryGET } from "../app/api/kitchen/batch/summary/route";

beforeEach(() => {
  mockRole = "kitchen";
  adminDb = makeAdminMock({
    profiles: [{ id: "p1", user_id: "u1", company_id: COMPANY_ID, location_id: LOCATION_ID, disabled_at: null, is_active: true }],
    company_locations: [{ id: LOCATION_ID, company_id: COMPANY_ID }],
    kitchen_batch: [
      { id: "b1", delivery_date: "2026-02-02", delivery_window: "dinner", company_location_id: LOCATION_ID, status: "PACKED", packed_at: "t", delivered_at: null },
      { id: "b2", delivery_date: "2026-02-02", delivery_window: "lunch", company_location_id: LOCATION_ID, status: "PACKED", packed_at: "t", delivered_at: null },
    ],
    orders: [
      { slot: "lunch", location_id: LOCATION_ID, company_id: COMPANY_ID },
      { slot: "lunch", location_id: LOCATION_ID, company_id: COMPANY_ID },
      { slot: "dinner", location_id: LOCATION_ID, company_id: COMPANY_ID },
    ],
  });
});

describe("kitchen batch/summary", () => {
  test("kitchen f�r 200 og deterministisk sortering", async () => {
    const req = mkReq(`http://localhost/api/kitchen/batch/summary?date=2026-02-02&location_id=${LOCATION_ID}`, { method: "GET" });
    const res = await batchSummaryGET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    const slots = (json?.data?.slots ?? []).map((s: any) => s.slot);
    expect(slots).toEqual(["dinner", "lunch"]);
    const slotLocs = (json?.data?.slot_locations ?? []).map((s: any) => s.slot);
    expect(slotLocs).toEqual(["dinner", "lunch"]);
    expect(json?.data?.counts?.orders).toBe(3);
  });

  test("wrong tenant f�r 403", async () => {
    adminDb = makeAdminMock({
      profiles: [{ id: "p1", user_id: "u1", company_id: OTHER_COMPANY, location_id: LOCATION_ID, disabled_at: null, is_active: true }],
      company_locations: [{ id: LOCATION_ID, company_id: COMPANY_ID }],
      kitchen_batch: [{ id: "b1", delivery_date: "2026-02-02", delivery_window: "lunch", company_location_id: LOCATION_ID, status: "PACKED" }],
      orders: [{ slot: "lunch", location_id: LOCATION_ID, company_id: COMPANY_ID }],
    });

    const req = mkReq(`http://localhost/api/kitchen/batch/summary?date=2026-02-02&location_id=${LOCATION_ID}`, { method: "GET" });
    const res = await batchSummaryGET(req);
    expect(res.status).toBe(403);
  });

  test("kitchen kan ikke hente annet enn i dag", async () => {
    const req = mkReq(`http://localhost/api/kitchen/batch/summary?date=2026-02-01&location_id=${LOCATION_ID}`, { method: "GET" });
    const res = await batchSummaryGET(req);
    expect(res.status).toBe(403);
  });

  test("non-kitchen f�r 403", async () => {
    mockRole = "employee";
    const req = mkReq(`http://localhost/api/kitchen/batch/summary?date=2026-02-02&location_id=${LOCATION_ID}`, { method: "GET" });
    const res = await batchSummaryGET(req);
    expect(res.status).toBe(403);
  });

  test("422 n�r ingen orders", async () => {
    adminDb = makeAdminMock({
      profiles: [{ id: "p1", user_id: "u1", company_id: COMPANY_ID, location_id: LOCATION_ID, disabled_at: null, is_active: true }],
      company_locations: [{ id: LOCATION_ID, company_id: COMPANY_ID }],
      kitchen_batch: [{ id: "b1", delivery_date: "2026-02-02", delivery_window: "lunch", company_location_id: LOCATION_ID, status: "PACKED" }],
      orders: [],
    });

    const req = mkReq(`http://localhost/api/kitchen/batch/summary?date=2026-02-02&location_id=${LOCATION_ID}`, { method: "GET" });
    const res = await batchSummaryGET(req);
    expect(res.status).toBe(422);
  });
});
