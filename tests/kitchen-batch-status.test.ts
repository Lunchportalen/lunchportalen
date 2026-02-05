// tests/kitchen-batch-status.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "22222222-2222-2222-2222-222222222222";
const LOCATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_LOCATION = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

let mockRole = "kitchen";
let mockCutoff = "TODAY_LOCKED";
let mockRace = false;

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
        route: "/api/kitchen/batch/set",
        method: "POST",
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
  cutoffStatusForDate0805: () => mockCutoff,
}));

function makeAdminMock(seed?: { profiles?: any[]; company_locations?: any[]; kitchen_batch?: any[] }) {
  const db = {
    profiles: seed?.profiles ?? [],
    company_locations: seed?.company_locations ?? [],
    kitchen_batch: seed?.kitchen_batch ?? [],
  };

  function applyFilters(rows: any[], filters: Array<{ k: string; v: any }>) {
    return rows.filter((r) => filters.every((f) => String((r as any)?.[f.k] ?? "") === String(f.v ?? "")));
  }

  return {
    from: (table: string) => {
      const state: any = { table, filters: [], writeKind: null, writePayload: null };
      const q: any = {
        select: () => q,
        eq: (k: string, v: any) => {
          state.filters.push({ k, v });
          return q;
        },
        in: () => q,
        maybeSingle: async () => {
          if (state.writeKind === "update" && table === "kitchen_batch") {
            if (mockRace) return { data: null, error: null };
            const row = applyFilters(db.kitchen_batch, state.filters)[0] ?? null;
            if (!row) return { data: null, error: null };
            Object.assign(row, state.writePayload);
            return { data: row, error: null };
          }
          const rows = applyFilters(db[table as keyof typeof db] ?? [], state.filters);
          return { data: rows[0] ?? null, error: null };
        },
        update: (payload: any) => {
          state.writeKind = "update";
          state.writePayload = payload;
          return q;
        },
        then: (resolve: any) => resolve({ data: [], error: null }),
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

vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async () => true),
}));

import { POST as batchSetPOST } from "../app/api/kitchen/batch/set/route";

beforeEach(() => {
  mockRole = "kitchen";
  mockCutoff = "TODAY_LOCKED";
  mockRace = false;
  adminDb = makeAdminMock({
    profiles: [{ id: "p1", user_id: "u1", company_id: COMPANY_ID, location_id: LOCATION_ID, disabled_at: null, is_active: true }],
    company_locations: [
      { id: LOCATION_ID, company_id: COMPANY_ID },
      { id: OTHER_LOCATION, company_id: OTHER_COMPANY },
    ],
    kitchen_batch: [
      { id: "b1", delivery_date: "2026-02-02", delivery_window: "lunch", company_location_id: LOCATION_ID, status: "QUEUED", packed_at: null, delivered_at: null },
    ],
  });
});

describe("kitchen batch/status", () => {
  test("kitchen kan endre status fremover (QUEUED -> PACKED)", async () => {
    const req = mkReq("http://localhost/api/kitchen/batch/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", location_id: LOCATION_ID, status: "PACKED" }),
    });

    const res = await batchSetPOST(req);
    expect(res.status).toBe(200);
  });

  test("kitchen kan ikke reversere status", async () => {
    adminDb = makeAdminMock({
      profiles: [{ id: "p1", user_id: "u1", company_id: COMPANY_ID, location_id: LOCATION_ID, disabled_at: null, is_active: true }],
      company_locations: [{ id: LOCATION_ID, company_id: COMPANY_ID }],
      kitchen_batch: [
        { id: "b1", delivery_date: "2026-02-02", delivery_window: "lunch", company_location_id: LOCATION_ID, status: "DELIVERED", packed_at: "t", delivered_at: "t" },
      ],
    });

    const req = mkReq("http://localhost/api/kitchen/batch/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", location_id: LOCATION_ID, status: "PACKED" }),
    });

    const res = await batchSetPOST(req);
    expect(res.status).toBe(409);
  });

  test("kitchen kan ikke hoppe over status", async () => {
    const req = mkReq("http://localhost/api/kitchen/batch/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", location_id: LOCATION_ID, status: "DELIVERED" }),
    });

    const res = await batchSetPOST(req);
    expect(res.status).toBe(422);
  });

  test("wrong tenant kan ikke endre batch", async () => {
    const req = mkReq("http://localhost/api/kitchen/batch/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", location_id: OTHER_LOCATION, status: "PACKED" }),
    });

    const res = await batchSetPOST(req);
    expect(res.status).toBe(403);
  });

  test("non-kitchen får 403", async () => {
    mockRole = "employee";
    const req = mkReq("http://localhost/api/kitchen/batch/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", location_id: LOCATION_ID, status: "PACKED" }),
    });

    const res = await batchSetPOST(req);
    expect(res.status).toBe(403);
  });

  test("idempotent: samme status to ganger", async () => {
    adminDb = makeAdminMock({
      profiles: [{ id: "p1", user_id: "u1", company_id: COMPANY_ID, location_id: LOCATION_ID, disabled_at: null, is_active: true }],
      company_locations: [{ id: LOCATION_ID, company_id: COMPANY_ID }],
      kitchen_batch: [
        { id: "b1", delivery_date: "2026-02-02", delivery_window: "lunch", company_location_id: LOCATION_ID, status: "PACKED", packed_at: "t", delivered_at: null },
      ],
    });

    const req = mkReq("http://localhost/api/kitchen/batch/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", location_id: LOCATION_ID, status: "PACKED" }),
    });

    const res = await batchSetPOST(req);
    expect(res.status).toBe(200);
  });

  test("race: to samtidige updates -> 409", async () => {
    mockRace = true;
    const req = mkReq("http://localhost/api/kitchen/batch/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-02-02", slot: "lunch", location_id: LOCATION_ID, status: "PACKED" }),
    });

    const res = await batchSetPOST(req);
    expect(res.status).toBe(409);
  });
});
