// tests/kitchen-print.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const LOCATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_LOCATION = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SLOT = "lunch";

let mockCutoff: "TODAY_LOCKED" | "TODAY_OPEN" | "FUTURE_OPEN" | "PAST" = "TODAY_LOCKED";
let mockRole = "superadmin";

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
        route: "/api/cron/kitchen-print",
        method: "GET",
        scope: {
          userId: "u1",
          role: mockRole,
          companyId: "cA",
          locationId: "l1",
          email: "superadmin.test@lunchportalen.no",
        },
      },
    })),
  };
});

vi.mock("@/lib/date/oslo", () => ({
  osloTodayISODate: () => "2026-02-02",
  osloNowISO: () => "2026-02-02T08:10:00",
  cutoffStatusForDate0805: () => mockCutoff,
  isIsoDate: (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")),
}));

function makeAdminMock(seed?: {
  company_locations?: any[];
  kitchen_batch?: any[];
  orders?: any[];
  profiles?: any[];
  companies?: any[];
}) {
  const db = {
    company_locations: seed?.company_locations ?? [],
    kitchen_batch: seed?.kitchen_batch ?? [],
    orders: seed?.orders ?? [],
    profiles: seed?.profiles ?? [],
    companies: seed?.companies ?? [],
  };

  function applyFilters(
    rows: any[],
    filters: Array<{ k: string; v: any }>,
    inFilters: Record<string, any[]>,
    isFilters: Array<{ k: string; v: any }>,
    lteFilters: Array<{ k: string; v: any }>
  ) {
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
      for (const f of lteFilters) {
        const leftRaw = String((r as any)?.[f.k] ?? "");
        const rightRaw = String(f.v ?? "");
        const leftTs = Date.parse(leftRaw);
        const rightTs = Date.parse(rightRaw);
        if (Number.isFinite(leftTs) && Number.isFinite(rightTs)) {
          if (leftTs > rightTs) return false;
        } else if (leftRaw > rightRaw) {
          return false;
        }
      }
      return true;
    });
  }

  return {
    from: (table: string) => {
      const state: any = { table, filters: [], inFilters: {}, isFilters: [], lteFilters: [] };
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
        lte: (k: string, v: any) => {
          state.lteFilters.push({ k, v });
          return q;
        },
        order: () => q,
        update: () => {
          throw new Error("print must be read-only");
        },
        insert: () => {
          throw new Error("print must be read-only");
        },
        maybeSingle: async () => {
          const rows = applyFilters(
            db[table as keyof typeof db] ?? [],
            state.filters,
            state.inFilters,
            state.isFilters,
            state.lteFilters
          );
          return { data: rows[0] ?? null, error: null };
        },
        then: (resolve: any) => {
          const rows = applyFilters(
            db[table as keyof typeof db] ?? [],
            state.filters,
            state.inFilters,
            state.isFilters,
            state.lteFilters
          );
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

import { GET as kitchenPrintGET } from "../app/api/cron/kitchen-print/route";

beforeEach(() => {
  mockCutoff = "TODAY_LOCKED";
  mockRole = "superadmin";
  process.env.CRON_SECRET = "secret";
  adminDb = makeAdminMock({
    company_locations: [{ id: LOCATION_ID, company_id: COMPANY_ID }],
    kitchen_batch: [{ id: "b1", delivery_date: "2026-02-02", delivery_window: SLOT, company_location_id: LOCATION_ID, status: "PACKED", packed_at: "t", delivered_at: null }],
    orders: [
      { id: "o1", slot: SLOT, location_id: LOCATION_ID, company_id: COMPANY_ID, user_id: "u1", date: "2026-02-02", status: "ACTIVE", integrity_status: "ok", created_at: "2026-02-02T07:00:00Z", note: null },
      { id: "o2", slot: SLOT, location_id: LOCATION_ID, company_id: COMPANY_ID, user_id: "u2", date: "2026-02-02", status: "ACTIVE", integrity_status: "ok", created_at: "2026-02-02T07:05:00Z", note: "uten nøtter" },
    ],
    profiles: [
      { user_id: "u1", full_name: "Ansatt 1", department: "Salg", company_id: COMPANY_ID },
      { user_id: "u2", full_name: "Ansatt 2", department: "IT", company_id: COMPANY_ID },
    ],
    companies: [{ id: COMPANY_ID, name: "Firma A" }],
  });
});

describe("kitchen-print cron", () => {
  test("print f?r 08:05 -> avvist", async () => {
    mockCutoff = "TODAY_OPEN";
    const req = mkReq(`http://localhost/api/cron/kitchen-print?date=2026-02-02&slot=${SLOT}&location_id=${LOCATION_ID}`, {
      method: "GET",
      headers: { "x-cron-secret": "secret" },
    });
    const res = await kitchenPrintGET(req);
    expect(res.status).toBe(425);
  });

  test("print uten batch -> avvist", async () => {
    adminDb = makeAdminMock({
      company_locations: [{ id: LOCATION_ID, company_id: COMPANY_ID }],
      kitchen_batch: [],
      orders: [],
    });

    const req = mkReq(`http://localhost/api/cron/kitchen-print?date=2026-02-02&slot=${SLOT}&location_id=${LOCATION_ID}`, {
      method: "GET",
      headers: { "x-cron-secret": "secret" },
    });
    const res = await kitchenPrintGET(req);
    expect(res.status).toBe(404);
  });

  test("print med batch -> ok", async () => {
    const req = mkReq(`http://localhost/api/cron/kitchen-print?date=2026-02-02&slot=${SLOT}&location_id=${LOCATION_ID}`, {
      method: "GET",
      headers: { "x-cron-secret": "secret" },
    });
    const res = await kitchenPrintGET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json?.data?.payload?.counts?.orders).toBe(2);
    expect(Array.isArray(json?.data?.payload?.groups)).toBe(true);
    expect(json?.data?.payload?.groups?.[0]?.orders?.length ?? 0).toBe(2);
  });

  test("print to ganger -> samme resultat", async () => {
    const req = mkReq(`http://localhost/api/cron/kitchen-print?date=2026-02-02&slot=${SLOT}&location_id=${LOCATION_ID}`, {
      method: "GET",
      headers: { "x-cron-secret": "secret" },
    });
    const first = await kitchenPrintGET(req);
    const second = await kitchenPrintGET(req);
    const j1 = await first.json();
    const j2 = await second.json();
    expect(j1?.data?.payload_hash).toBe(j2?.data?.payload_hash);
  });

  test("feil tenant -> avvist", async () => {
    adminDb = makeAdminMock({
      company_locations: [{ id: OTHER_LOCATION, company_id: COMPANY_ID }],
      kitchen_batch: [{ id: "b1", delivery_date: "2026-02-02", delivery_window: SLOT, company_location_id: OTHER_LOCATION, status: "PACKED" }],
      orders: [{ slot: SLOT, location_id: OTHER_LOCATION, company_id: COMPANY_ID }],
    });

    const req = mkReq(`http://localhost/api/cron/kitchen-print?date=2026-02-02&slot=${SLOT}&location_id=${LOCATION_ID}`, {
      method: "GET",
      headers: { "x-cron-secret": "secret" },
    });
    const res = await kitchenPrintGET(req);
    expect(res.status).toBe(404);
  });

  test("non-superadmin uten cron secret -> 403", async () => {
    mockRole = "employee";
    const req = mkReq(`http://localhost/api/cron/kitchen-print?date=2026-02-02&slot=${SLOT}&location_id=${LOCATION_ID}`, {
      method: "GET",
    });
    const res = await kitchenPrintGET(req);
    expect(res.status).toBe(403);
  });
});


