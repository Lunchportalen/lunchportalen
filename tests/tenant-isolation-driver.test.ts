// tests/tenant-isolation-driver.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}

/** Gyldige UUID-er — samme filterlogikk som loadOperativeKitchenOrders (userIds0 / isUuid). */
const DRIVER_UID = "11111111-1111-4111-8111-111111111111";
const TENANT_CO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_LOC = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TENANT_CO_OTHER = "cccccccc-cccc-4000-8000-cccccccccccc";
const ORDER_EMPLOYEE = "22222222-2222-4222-8222-222222222222";

let eqCalls: Array<{ table: string; key: string; value: string }> = [];
let adminConfig: {
  /** Ekstra lokasjoner for company_locations.in (bulk-set validering) */
  companyLocations?: string[];
  /** Operative ordre-rader (location_id) — legacy felt brukt kun av bulk-set test */
  orderLocations?: string[];
} = {};

type Seed = {
  orders?: any[];
  day_choices?: any[];
  production_operative_snapshots?: any[];
  companies?: any[];
  company_locations?: any[];
  profiles?: any[];
  delivery_confirmations?: any[];
  kitchen_batches?: any[];
};

let seed: Required<Seed> = {
  orders: [],
  day_choices: [],
  production_operative_snapshots: [],
  companies: [],
  company_locations: [],
  profiles: [],
  delivery_confirmations: [],
  kitchen_batches: [],
};

function resetSeed(next: Seed) {
  seed = {
    orders: next.orders ?? [],
    day_choices: next.day_choices ?? [],
    production_operative_snapshots: next.production_operative_snapshots ?? [],
    companies: next.companies ?? [],
    company_locations: next.company_locations ?? [],
    profiles: next.profiles ?? [],
    delivery_confirmations: next.delivery_confirmations ?? [],
    kitchen_batches: next.kitchen_batches ?? [],
  };
}

function applyFilters(rows: any[], filters: { k: string; v: string }[], ins: Record<string, string[]>, limitN: number | null) {
  let out = [...rows];
  for (const f of filters) {
    out = out.filter((r) => String((r as any)?.[f.k] ?? "") === f.v);
  }
  for (const [k, vals] of Object.entries(ins)) {
    const set = new Set(vals.map(String));
    out = out.filter((r) => set.has(String((r as any)?.[k] ?? "")));
  }
  if (limitN != null && Number.isFinite(limitN)) out = out.slice(0, limitN);
  return out;
}

function mergeCompanyLocations() {
  const base = [...seed.company_locations];
  const extra = adminConfig.companyLocations ?? [];
  const seen = new Set(base.map((x) => String(x.id)));
  for (const id of extra) {
    if (seen.has(id)) continue;
    seen.add(id);
    base.push({ id, company_id: TENANT_CO });
  }
  return base;
}

function effectiveOrders() {
  const locs = adminConfig.orderLocations;
  if (locs && locs.length) {
    return locs.map((location_id: string) => ({
      id: `gen-${location_id}`,
      user_id: ORDER_EMPLOYEE,
      company_id: TENANT_CO,
      location_id,
      date: "2026-02-02",
      status: "ACTIVE",
      slot: "lunch",
      note: null,
    }));
  }
  return [...seed.orders];
}

let adminSingleton: any = null;

function createAdmin() {
  return {
    from(table: string) {
      const baseTable =
        table === "company_locations" ? mergeCompanyLocations() : (((seed as any)[table] as any[]) ?? []);
      const base = table === "orders" ? effectiveOrders() : [...baseTable];

      const st = {
        filters: [] as { k: string; v: string }[],
        ins: {} as Record<string, string[]>,
        limitN: null as number | null,
      };

      const q: any = {
        select: () => q,
        eq: (k: string, v: any) => {
          st.filters.push({ k, v: String(v ?? "") });
          eqCalls.push({ table, key: k, value: String(v ?? "") });
          return q;
        },
        in: (k: string, v: any) => {
          const arr = (Array.isArray(v) ? v : [v]).map(String);
          st.ins[k] = arr;
          return q;
        },
        limit: (n: number) => {
          st.limitN = n;
          return q;
        },
        order: () => q,
        maybeSingle: async () => {
          const rows = applyFilters(base, st.filters, st.ins, st.limitN);
          return { data: rows[0] ?? null, error: null };
        },
        upsert: (payload: any) => ({
          select: () => ({
            maybeSingle: async () => {
              const rows = Array.isArray(payload) ? payload : [payload];
              return {
                data: rows[0]
                  ? {
                      id: "dc1",
                      delivery_date: rows[0].delivery_date,
                      slot: rows[0].slot,
                      company_id: rows[0].company_id,
                      location_id: rows[0].location_id,
                      confirmed_at: "2026-02-02T10:00:00Z",
                      confirmed_by: rows[0].confirmed_by,
                      rid: rows[0].rid,
                      note: rows[0].note,
                    }
                  : null,
                error: null,
              };
            },
            then: (resolve: any) => {
              const rows = Array.isArray(payload) ? payload : [payload];
              resolve({
                data: rows.map((r: any, i: number) => ({
                  delivery_date: r.delivery_date,
                  delivery_window: r.delivery_window,
                  company_location_id: r.company_location_id,
                  status: r.status,
                  packed_at: r.packed_at,
                  delivered_at: r.delivered_at,
                  id: `b${i}`,
                })),
                error: null,
              });
            },
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
          const data = applyFilters(base, st.filters, st.ins, st.limitN);
          resolve({ data, error: null });
        },
      };
      return q;
    },
  };
}

function getAdmin() {
  if (!adminSingleton) adminSingleton = createAdmin();
  return adminSingleton;
}

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
          userId: DRIVER_UID,
          role: "driver",
          companyId: TENANT_CO,
          locationId: TENANT_LOC,
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

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,
    supabaseAdmin: () => getAdmin(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: DRIVER_UID, email: "driver.test@lunchportalen.no" } }, error: null }) },
    from: (t: string) => getAdmin().from(t),
  }),
}));

import { GET as driverStopsGET } from "../app/api/driver/stops/route";
import { POST as driverConfirmPOST } from "../app/api/driver/confirm/route";
import { GET as driverCsvGET } from "../app/driver/csv/route";
import { POST as driverBulkSetPOST } from "../app/api/driver/bulk-set/route";

const defaultProfile = {
  id: DRIVER_UID,
  user_id: DRIVER_UID,
  company_id: TENANT_CO,
  location_id: TENANT_LOC,
  disabled_at: null,
  is_active: true,
};

beforeEach(() => {
  eqCalls = [];
  adminConfig = {};
  adminSingleton = null;
  resetSeed({
    profiles: [defaultProfile],
    companies: [{ id: TENANT_CO, name: "CoA" }],
    company_locations: [{ id: TENANT_LOC, company_id: TENANT_CO, name: "L1" }],
    orders: [
      {
        id: "00000001-0001-4001-8001-000000000001",
        user_id: ORDER_EMPLOYEE,
        company_id: TENANT_CO,
        location_id: TENANT_LOC,
        date: "2026-02-02",
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ],
    day_choices: [],
  });
});

describe("tenant isolation — driver stops", () => {
  test("orders and confirmations are filtered by company_id", async () => {
    const req = mkReq("http://localhost/api/driver/stops?date=2026-02-02", { method: "GET" });
    const res = await driverStopsGET(req);
    expect(res.status).toBe(200);

    const ordersCompany = eqCalls.find((c) => c.table === "orders" && c.key === "company_id");
    const confCompany = eqCalls.find((c) => c.table === "delivery_confirmations" && c.key === "company_id");

    expect(ordersCompany?.value).toBe(TENANT_CO);
    expect(confCompany?.value).toBe(TENANT_CO);
  });
});

describe("driver isolation — confirm/csv/bulk-set", () => {
  test("driver cannot mark other company stop", async () => {
    const req = mkReq("http://localhost/api/driver/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", companyId: TENANT_CO_OTHER, locationId: TENANT_LOC }),
    });
    const res = await driverConfirmPOST(req);
    expect(res.status).toBe(403);
  });

  test("driver confirm ok returns minimal confirmation (no internal ids in payload)", async () => {
    const req = mkReq("http://localhost/api/driver/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", companyId: TENANT_CO, locationId: TENANT_LOC }),
    });
    const res = await driverConfirmPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    const c = body?.data?.confirmation;
    expect(c).toBeTruthy();
    expect(c.confirmed_by).toBeUndefined();
    expect(c.note).toBeUndefined();
    expect(c.rid).toBeUndefined();
    expect(c.delivery_date).toBe("2026-02-02");
    expect(c.slot).toBe("lunch");
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
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", status: "PACKED", locationIds: [TENANT_LOC] }),
    });
    const res = await driverBulkSetPOST(req);
    expect(res.status).toBe(403);
  });

  test("bulk-set rejects non-today date", async () => {
    const req = mkReq("http://localhost/api/driver/bulk-set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-01", slot: "lunch", status: "DELIVERED", locationIds: [TENANT_LOC] }),
    });
    const res = await driverBulkSetPOST(req);
    expect(res.status).toBe(403);
  });

  test("bulk-set requires locations to be in today's stops", async () => {
    const locOnRoute = "11111111-1111-4111-8111-111111111111";
    const locOther = "22222222-2222-4222-8222-222222222222";
    adminConfig.companyLocations = [locOnRoute, locOther];
    adminConfig.orderLocations = [locOnRoute];
    const req = mkReq("http://localhost/api/driver/bulk-set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", status: "DELIVERED", locationIds: [locOther] }),
    });
    const res = await driverBulkSetPOST(req);
    expect(res.status).toBe(403);
  });
});
