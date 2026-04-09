// tests/security/roleIsolationEndpoints.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

/* =========================================================
   Helpers
========================================================= */
function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}
function safeStr(v: any) {
  return String(v ?? "").trim();
}
async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return {}; // ? aldri null/undefined
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

/* =========================================================
   In-memory Supabase ADMIN mock
   - brukes av kitchen/orders + kitchen/batch/set
========================================================= */
function makeAdminDbMock(seed?: { profiles?: any[]; kitchen_batch?: any[]; company_locations?: any[] }) {
  const db = {
    profiles: seed?.profiles ?? [],
    kitchen_batch: seed?.kitchen_batch ?? [],
    company_locations: seed?.company_locations ?? [],
  };

  function from(table: string) {
    const state: any = { table, filters: [], _writeKind: null, _write: null };

    const api: any = {
      select(_sel: string) {
        return api;
      },
      eq(k: string, v: any) {
        state.filters.push({ k, v });
        return api;
      },
      in() {
        return api;
      },
      order() {
        return api;
      },
      update(payload: any) {
        state._writeKind = "update";
        state._write = payload;
        return api;
      },
      upsert(payload: any) {
        state._writeKind = "upsert";
        state._write = payload;
        return api;
      },
      async maybeSingle() {
        // profiles gate (kitchen/orders)
        if (!state._writeKind && table === "profiles") {
          const user_id = state.filters.find((f: any) => f.k === "user_id")?.v;
          const id = state.filters.find((f: any) => f.k === "id")?.v;
          const row =
            db.profiles.find((p: any) => safeStr(p.user_id) === safeStr(user_id)) ??
            db.profiles.find((p: any) => safeStr(p.id) === safeStr(id)) ??
            null;
          return { data: row, error: null };
        }

        if (!state._writeKind && table === "company_locations") {
          const id = state.filters.find((f: any) => f.k === "id")?.v;
          const row = db.company_locations.find((l: any) => safeStr(l.id) === safeStr(id)) ?? null;
          return { data: row, error: null };
        }
        if (!state._writeKind && table === "kitchen_batch") {
          const row =
            db.kitchen_batch.find((r: any) => state.filters.every((f: any) => safeStr(r[f.k]) === safeStr(f.v))) ??
            null;
          return { data: row, error: null };
        }

        // kitchen_batch update (kitchen/batch/set)
        if (state._writeKind === "update" && table === "kitchen_batch") {
          const row = db.kitchen_batch.find((r: any) => state.filters.every((f: any) => safeStr(r[f.k]) === safeStr(f.v))) ?? null;
          if (!row) return { data: null, error: null };
          Object.assign(row, state._write);
          return { data: row, error: null };
        }

        // kitchen_batch upsert (legacy)
        if (state._writeKind === "upsert" && table === "kitchen_batch") {
          const p = state._write;
          const idx = db.kitchen_batch.findIndex(
            (r: any) =>
              safeStr(r.delivery_date) === safeStr(p.delivery_date) &&
              safeStr(r.delivery_window) === safeStr(p.delivery_window) &&
              safeStr(r.company_location_id) === safeStr(p.company_location_id)
          );
          if (idx === -1) db.kitchen_batch.push({ ...p });
          else db.kitchen_batch[idx] = { ...db.kitchen_batch[idx], ...p };

          const row = idx === -1 ? db.kitchen_batch[db.kitchen_batch.length - 1] : db.kitchen_batch[idx];
          return { data: row, error: null };
        }

        return { data: null, error: null };
      },
      then(resolve: any) {
        if (table === "company_locations") {
          resolve({ data: db.company_locations ?? [], error: null });
          return;
        }
        resolve({ data: [], error: null });
      },
    };

    return api;
  }

  return { from };
}

let adminDb: any;

/* =========================================================
   Mocks
========================================================= */

// getScope -> routeGuard scopeOr401
vi.mock("@/lib/auth/scope", () => ({
  getScope: vi.fn(async (req: any) => {
    const h = (k: string) => safeStr(req?.headers?.get?.(k) ?? req?.headers?.[k]);
    return {
      userId: h("x-mock-user") || null,
      role: h("x-mock-role") || null,
      companyId: h("x-mock-company") || null,
      locationId: h("x-mock-location") || null,
      email: h("x-mock-email") || "test@lunchportalen.no",
    };
  }),
}));

// supabaseAdmin -> brukes av admin/orders + kitchen/orders + kitchen/batch/set (service role)
vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => adminDb,
  };
});

// supabaseServer -> brukes av kitchen/* for cookie-session gate
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u_cookie" } }, error: null }),
    },
  }),
}));

// audit -> irrelevant for disse testene
vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async () => true),
}));

vi.mock("@/lib/date/oslo", () => ({
  osloTodayISODate: () => "2026-01-29",
  cutoffStatusForDate0805: () => "TODAY_LOCKED",
}));

/* =========================================================
   Import routes (relative from tests/security -> app/api)
========================================================= */
import { GET as adminOrdersGET } from "../../app/api/admin/orders/route";
import { GET as kitchenOrdersGET } from "../../app/api/kitchen/orders/route";
import { POST as kitchenBatchSetPOST } from "../../app/api/kitchen/batch/set/route";
import { POST as kitchenBatchStartPOST } from "../../app/api/kitchen/batch/start/route";

/* =========================================================
   Seed
========================================================= */
beforeEach(() => {
  adminDb = makeAdminDbMock({
    profiles: [
      // cookie-user er kitchen som default
      { id: "u_cookie", user_id: "u_cookie", role: "kitchen", disabled_at: null, is_active: true, company_id: "c_test", location_id: "l_test" },
    ],
    kitchen_batch: [
      { id: "b1", delivery_date: "2026-01-29", delivery_window: "lunch", company_location_id: "l_test", status: "QUEUED", packed_at: null, delivered_at: null },
    ],
    company_locations: [{ id: "l_test", company_id: "c_test" }],
  });
});

/* =========================================================
   Tests
========================================================= */
describe("Dag-11B – Role isolation (API routes)", () => {
  test("admin/orders: employee skal få 403", async () => {
    const req = mkReq("http://localhost/api/admin/orders?date=2026-01-29", {
      method: "GET",
      headers: {
        "x-mock-user": "u_emp", // ? viktig (ellers 401)
        "x-mock-role": "employee",
        "x-mock-company": "c_test",
        "x-mock-location": "l_test",
      },
    });

    const res = await adminOrdersGET(req);
    expect(res.status).toBe(403);
  });

  test("kitchen/batch/set: employee skal få 403", async () => {
    const req = mkReq("http://localhost/api/kitchen/batch/set", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mock-user": "u_emp", // ? viktig (ellers 401)
        "x-mock-role": "employee",
        "x-mock-company": "c_test",
        "x-mock-location": "l_test",
      },
      body: JSON.stringify({ date: "2026-01-29", slot: "lunch", location_id: "l_test", status: "PACKED" }),
    });

    const res = await kitchenBatchSetPOST(req);
    expect(res.status).toBe(403);
  });

  test("kitchen/batch/start: employee skal få 403", async () => {
    const req = mkReq("http://localhost/api/kitchen/batch/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mock-user": "u_emp",
        "x-mock-role": "employee",
        "x-mock-company": "c_test",
        "x-mock-location": "l_test",
      },
      body: JSON.stringify({ date: "2026-01-29", slot: "lunch", location_id: "l_test" }),
    });

    const res = await kitchenBatchStartPOST(req);
    expect(res.status).toBe(403);
  });

  test("kitchen/batch/set: kitchen får 200 og status=PACKED", async () => {
    const req = mkReq("http://localhost/api/kitchen/batch/set", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mock-user": "u_kitchen", // ? viktig (ellers 401)
        "x-mock-role": "kitchen",
        "x-mock-company": "c_test",
        "x-mock-location": "l_test",
      },
      body: JSON.stringify({ date: "2026-01-29", slot: "lunch", location_id: "l_test", status: "PACKED" }),
    });

    const res = await kitchenBatchSetPOST(req);
    expect(res.status).toBe(200);

    const json = await readJson(res);

    // ? Streng men kompatibel: status kan ligge flere steder avhengig av route-kontrakt
    const status =
      json?.batch?.status ??
      json?.data?.batch?.status ??
      json?.result?.batch?.status ??
      json?.after?.status ??
      json?.status ??
      null;

    expect(String(status)).toBe("PACKED");
  });

  test("kitchen/orders: company_admin skal få 403 (role gate via profiles)", async () => {
    // kitchen/orders role gate er basert på cookie-user profilrolle (profiles.user_id = u_cookie)
    adminDb = makeAdminDbMock({
      profiles: [{ id: "p_cookie", user_id: "u_cookie", role: "company_admin", disabled_at: null, is_active: true }],
      kitchen_batch: [],
    });

    const req = mkReq("http://localhost/api/kitchen/orders?date=2026-01-29", { method: "GET" });
    const res = await kitchenOrdersGET(req);
    expect(res.status).toBe(403);
  });
});
