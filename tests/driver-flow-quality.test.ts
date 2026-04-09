// tests/driver-flow-quality.test.ts
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}

let eqCalls: Array<{ table: string; key: string; value: string }> = [];
let inCalls: Array<{ table: string; key: string; values: any[] }> = [];

let ordersRows: any[] = [];

const profileRow = {
  company_id: "cA",
  location_id: "l1",
  disabled_at: null,
  is_active: true,
};

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

function filterRows(table: string, q: any) {
  if (table !== "orders") {
    return [];
  }
  let out = ordersRows.slice();

  // Apply eq filters
  for (const [key, val] of Object.entries(q._eq)) {
    out = out.filter((row) => String((row as any)[key] ?? "") === String(val ?? ""));
  }

  // Apply in filters
  for (const [key, vals] of Object.entries(q._in)) {
    const set = new Set((vals as any[]) ?? []);
    out = out.filter((row) => set.has((row as any)[key]));
  }

  return out;
}

function makeAdmin() {
  return {
    from: (table: string) => {
      const q: any = {
        _table: table,
        _eq: {} as Record<string, any>,
        _in: {} as Record<string, any[]>,
        select: () => q,
        eq: (k: string, v: any) => {
          eqCalls.push({ table, key: k, value: String(v ?? "") });
          q._eq[k] = v;
          return q;
        },
        in: (k: string, v: any) => {
          const arr = Array.isArray(v) ? v : [v];
          inCalls.push({ table, key: k, values: arr });
          q._in[k] = arr;
          return q;
        },
        order: () => q,
        limit: () => q,
        // Profile lookup for loadProfileByUserId
        maybeSingle: async () => {
          if (table === "profiles") {
            return { data: profileRow, error: null };
          }
          if (table === "company_locations") {
            const id = String(q._eq.id ?? "");
            if (!id) return { data: null, error: null };
            return { data: { id, company_id: profileRow.company_id }, error: null };
          }
          if (table === "delivery_confirmations") {
            return { data: null, error: null };
          }
          return { data: null, error: null };
        },
        upsert: (payload: any) => ({
          select: () => ({
            maybeSingle: async () => ({
              data: {
                ...payload,
                id: "conf1",
                confirmed_at: payload?.delivery_date + "T10:00:00Z",
                confirmed_by: payload?.confirmed_by ?? "u1",
              },
              error: null,
            }),
          }),
        }),
        then: (resolve: any) => {
          if (table === "orders") {
            const data = filterRows(table, q);
            return resolve({ data, error: null });
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
import { GET as driverCsvGET } from "../app/driver/csv/route";

async function readJson(res: Response) {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

beforeEach(() => {
  eqCalls = [];
  inCalls = [];
  ordersRows = [];
});

describe("driver day view – delivery truth", () => {
  test("includes only integrity_status=ok and non-cancelled statuses", async () => {
    ordersRows = [
      {
        id: "o1",
        date: "2026-02-02",
        slot: "08:00",
        status: "ACTIVE",
        integrity_status: "ok",
        company_id: "cA",
        location_id: "l1",
      },
      {
        id: "o2",
        date: "2026-02-02",
        slot: "08:00",
        status: "CANCELLED",
        integrity_status: "ok",
        company_id: "cA",
        location_id: "l1",
      },
      {
        id: "o3",
        date: "2026-02-02",
        slot: "08:00",
        status: "ACTIVE",
        integrity_status: "quarantined",
        company_id: "cA",
        location_id: "l1",
      },
      {
        id: "o4",
        date: "2026-02-02",
        slot: "08:00",
        status: "DELIVERED",
        integrity_status: "ok",
        company_id: "cA",
        location_id: "l1",
      },
    ];

    const req = mkReq("http://localhost/api/driver/stops?date=2026-02-02", { method: "GET" });
    const res = await driverStopsGET(req);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    const stops = body?.data?.stops ?? body?.stops ?? [];
    expect(stops.length).toBe(1);
    expect(stops[0].orderCount).toBe(2); // o1 + o4 only

    // Guard: route applied integrity + status filters
    const integrityEq = eqCalls.find((c) => c.table === "orders" && c.key === "integrity_status");
    expect(integrityEq?.value).toBe("ok");

    const statusIn = inCalls.find((c) => c.table === "orders" && c.key === "status");
    expect(statusIn?.values).toEqual(["ACTIVE", "QUEUED", "PACKED", "DELIVERED"]);
  });
});

describe("driver CSV export – aligned truth & malformed rows", () => {
  test("CSV loader uses same integrity/status filters as driver stops", async () => {
    ordersRows = [
      {
        id: "o1",
        date: "2026-02-02",
        slot: "lunch",
        status: "ACTIVE",
        integrity_status: "ok",
        company_id: "cA",
        location_id: "l1",
        user_id: "u1",
        note: "A",
      },
      {
        id: "o2",
        date: "2026-02-02",
        slot: "lunch",
        status: "CANCELLED",
        integrity_status: "ok",
        company_id: "cA",
        location_id: "l1",
        user_id: "u1",
        note: "B",
      },
    ];

    const req = mkReq("http://localhost/driver/csv?date=2026-02-02&window=lunch", { method: "GET" });
    const res = await driverCsvGET(req);
    expect(res.status).toBe(200);

    const integrityEq = eqCalls.find((c) => c.table === "orders" && c.key === "integrity_status");
    expect(integrityEq?.value).toBe("ok");

    const statusIn = inCalls.find((c) => c.table === "orders" && c.key === "status");
    expect(statusIn?.values).toEqual(["ACTIVE", "QUEUED", "PACKED", "DELIVERED"]);
  });

  test("malformed rows without company/location are excluded and yield header-only CSV", async () => {
    ordersRows = [
      {
        id: "o1",
        date: "2026-02-02",
        slot: "lunch",
        status: "ACTIVE",
        integrity_status: "ok",
        company_id: null,
        location_id: "l1",
        user_id: "u1",
        note: "A",
      },
      {
        id: "o2",
        date: "2026-02-02",
        slot: "lunch",
        status: "ACTIVE",
        integrity_status: "ok",
        company_id: "cA",
        location_id: null,
        user_id: "u1",
        note: "B",
      },
    ];

    const req = mkReq("http://localhost/driver/csv?date=2026-02-02&window=lunch", { method: "GET" });
    const res = await driverCsvGET(req);
    expect(res.status).toBe(200);

    const txt = await res.text();
    const lines = txt.trim().split("\n");

    // Header + no data rows
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("Leveringsvindu");
  });
}
);

