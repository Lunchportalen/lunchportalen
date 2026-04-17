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

/** Alle rader i responsen tilhører samme operative visnings-bucket (slot + firma + lokasjon som i rows-objektet). */
function expectKitchenRowsSingleDeliveryBucket(
  rows: any[],
  expected: { slot: string; company: string; location: string },
) {
  for (const r of Array.isArray(rows) ? rows : []) {
    expect(r.slot).toBe(expected.slot);
    expect(r.company).toBe(expected.company);
    expect(r.location).toBe(expected.location);
  }
}

/** Fasit: KitchenRow i app/api/kitchen/route.ts (JSON har alle nøkler). */
const KITCHEN_ROW_CONTRACT_KEYS = [
  "department",
  "employeeName",
  "location",
  "menu_allergens",
  "menu_description",
  "menu_title",
  "note",
  "orderId",
  "orderStatus",
  "company",
  "slot",
  "tier",
].sort();

function expectKitchenRowFieldContract(row: any) {
  expect(Object.keys(row).sort()).toEqual(KITCHEN_ROW_CONTRACT_KEYS);
  expect(Array.isArray(row.menu_allergens)).toBe(true);
}

function kitchenRowParityPayload(row: any) {
  return {
    orderId: row.orderId,
    slot: row.slot,
    orderStatus: row.orderStatus,
    company: row.company,
    location: row.location,
    employeeName: row.employeeName,
    department: row.department ?? null,
    note: row.note ?? null,
    tier: row.tier ?? null,
    menu_title: row.menu_title ?? null,
    menu_description: row.menu_description ?? null,
    menu_allergens: row.menu_allergens ?? [],
  };
}

/** summary speiler rows: antall rader, unike firma-navn, unike ansatte (app/api/kitchen/route.ts) — ingen desync meta↔rows. */
function expectKitchenSummaryInvariantsFromRows(rows: any[], summary: any) {
  const list = Array.isArray(rows) ? rows : [];
  expect(summary?.orders).toBe(list.length);
  expect(summary?.companies).toBe(new Set(list.map((r: any) => r.company)).size);
  expect(summary?.people).toBe(new Set(list.map((r: any) => r.employeeName)).size);
}

/**
 * Frozen allowlist endrer kun hvilke orderId som returneres; for overlappende id er kitchenRowParityPayload invariant vs live.
 * (Samme operative semantikk for slot, company, location, employee, meny/valg-felter.)
 */
function expectKitchenFrozenRowsFieldParityWithLive(liveRows: any[], frozenRows: any[]) {
  const liveById = new Map((liveRows ?? []).map((r: any) => [r.orderId, r]));
  for (const fr of frozenRows ?? []) {
    const lv = liveById.get(fr.orderId);
    expect(lv).toBeTruthy();
    expectKitchenRowFieldContract(fr);
    expectKitchenRowFieldContract(lv);
    expect(kitchenRowParityPayload(fr)).toEqual(kitchenRowParityPayload(lv));
  }
}

/** jsonOk: kun { ok, rid, data } (lib/http/respond.ts). */
function expectKitchenJsonEnvelopeOk(body: any) {
  expect(Object.keys(body ?? {}).sort()).toEqual(["data", "ok", "rid"].sort());
}

/** summary: kun orders / companies / people (KitchenData i app/api/kitchen/route.ts). */
function expectKitchenSummaryShapeMin(summary: any) {
  expect(new Set(Object.keys(summary ?? {}))).toEqual(new Set(["companies", "orders", "people"]));
}

/** production_operative_snapshot: kun active + frozen_at + captured_order_ids — ingen ekstra freeze-meta. */
function expectKitchenSnapshotMetaShapeMin(meta: any) {
  expect(new Set(Object.keys(meta ?? {}))).toEqual(new Set(["active", "captured_order_ids", "frozen_at"]));
}

/** Speiler `rows.sort` i app/api/kitchen/route.ts (stabil presentasjonsrekkefølge). */
function expectKitchenRowsCanonicallySorted(rows: any[]) {
  const list = Array.isArray(rows) ? rows : [];
  const sorted = [...list].sort((a, b) => {
    const s = String(a.slot ?? "").localeCompare(String(b.slot ?? ""), "nb");
    if (s !== 0) return s;
    const c = String(a.company ?? "").localeCompare(String(b.company ?? ""), "nb");
    if (c !== 0) return c;
    const l = String(a.location ?? "").localeCompare(String(b.location ?? ""), "nb");
    if (l !== 0) return l;
    const n = String(a.employeeName ?? "").localeCompare(String(b.employeeName ?? ""), "nb");
    if (n !== 0) return n;
    return String(a.orderId ?? "").localeCompare(String(b.orderId ?? ""), "nb");
  });
  expect(list.map((r) => r.orderId)).toEqual(sorted.map((r) => r.orderId));
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
          userId: "11111111-1111-4111-8111-111111111111",
          role: "kitchen",
          companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          locationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          email: "kitchen@test.lunchportalen.no",
        },
      },
    })),
  };
});

/** In-memory admin: orders, day_choices, snapshot + støttetabeller for GET /api/kitchen. */
function makeAdminMock(seed: {
  orders?: any[];
  day_choices?: any[];
  production_operative_snapshots?: any[];
  companies?: any[];
  company_locations?: any[];
  profiles?: any[];
}) {
  const db = {
    orders: seed.orders ?? [],
    day_choices: seed.day_choices ?? [],
    production_operative_snapshots: seed.production_operative_snapshots ?? [],
    companies: seed.companies ?? [],
    company_locations: seed.company_locations ?? [],
    profiles: seed.profiles ?? [],
  };

  return {
    from: (table: string) => {
      const baseRows = [...((db as any)[table] ?? [])];
      const state: any = {
        filters: [] as { k: string; v: string }[],
        inFilters: {} as Record<string, string[]>,
        limitN: null as number | null,
      };

      const apply = () => {
        let rows = baseRows;
        for (const f of state.filters) {
          rows = rows.filter((r: any) => String(r[f.k] ?? "") === f.v);
        }
        for (const [k, vals] of Object.entries(state.inFilters)) {
          const set = new Set(vals);
          rows = rows.filter((r: any) => set.has(String(r[k] ?? "")));
        }
        if (state.limitN != null && Number.isFinite(state.limitN)) {
          rows = rows.slice(0, state.limitN);
        }
        return rows;
      };

      const q: any = {
        select: () => q,
        eq: (k: string, v: any) => {
          state.filters.push({ k, v: String(v ?? "") });
          return q;
        },
        in: (k: string, vals: any[]) => {
          state.inFilters[k] = (Array.isArray(vals) ? vals : [vals]).map(String);
          return q;
        },
        limit: (n: number) => {
          state.limitN = n;
          return q;
        },
        order: () => q,
        then: (resolve: any) => {
          resolve({ data: apply(), error: null });
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

import { GET as kitchenGET } from "../../app/api/kitchen/route";

const K_DATE = "2026-02-03";
const K_CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const K_LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const K_U1 = "11111111-1111-4111-8111-111111111111";
const K_U2 = "22222222-2222-4222-8222-222222222222";
const K_O1 = "00000001-0001-4001-8001-000000000001";
const K_O2 = "00000002-0002-4002-8002-000000000002";
const K_CID_OTHER = "dddddddd-dddd-4000-8000-dddddddddddd";
const K_LID_OTHER = "eeeeeeee-eeee-4000-8000-eeeeeeeeeeee";
const K_U_OTHER = "66666666-6666-4666-8666-666666666666";
const K_O_OTHER = "0000000b-000b-400b-800b-00000000000b";

const kSupport = {
  companies: [{ id: K_CID, name: "TestCo", agreement_json: null }],
  company_locations: [{ id: K_LID, name: "Loc1", company_id: K_CID }],
  profiles: [
    { user_id: K_U1, full_name: "Arne", email: "arne@test.no", department: null, name: null },
    { user_id: K_U2, full_name: "Bente", email: "bente@test.no", department: null, name: null },
  ],
};

describe("api/kitchen – production visibility", () => {
  test("includes only ACTIVE orders and excludes cancelled/other statuses", async () => {
    adminDb = makeAdminMock({
      orders: [
        {
          id: "00000001-0001-4001-8001-000000000001",
          user_id: "11111111-1111-4111-8111-111111111111",
          company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          date: "2026-02-03",
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: "00000002-0002-4002-8002-000000000002",
          user_id: "22222222-2222-4222-8222-222222222222",
          company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          date: "2026-02-03",
          status: "active",
          slot: "lunch",
          note: null,
        },
        {
          id: "00000003-0003-4003-8003-000000000003",
          user_id: "33333333-3333-4333-8333-333333333333",
          company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          date: "2026-02-03",
          status: "CANCELED",
          slot: "lunch",
          note: null,
        },
        {
          id: "00000004-0004-4004-8004-000000000004",
          user_id: "44444444-4444-4444-8444-444444444444",
          company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          date: "2026-02-03",
          status: "QUEUED",
          slot: "lunch",
          note: null,
        },
      ],
    });

    const req = mkReq("http://localhost/api/kitchen?date=2026-02-03", { method: "GET" });
    const res = await kitchenGET(req);

    expect(res.status).toBe(200);
    const body = await readJson(res);

    expect(body?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(body);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expect(body?.data?.date).toBe("2026-02-03");
    const rows0 = body?.data?.rows ?? [];
    expectKitchenSummaryInvariantsFromRows(rows0, body?.data?.summary);
    const companies = new Set(rows0.map((r: any) => r.company));
    expect(companies.size).toBe(1);
    expectKitchenRowsCanonicallySorted(rows0);
    expectKitchenRowsSingleDeliveryBucket(rows0, {
      slot: "lunch",
      company: "Ukjent firma",
      location: "Lokasjon",
    });
    expect(rows0.map((r: any) => r.orderId)).toEqual([
      "00000001-0001-4001-8001-000000000001",
      "00000002-0002-4002-8002-000000000002",
    ]);
    for (const r of rows0) expectKitchenRowFieldContract(r);
  });

  test("fails closed when required company/location/user fields are missing", async () => {
    adminDb = makeAdminMock({
      orders: [
        {
          id: "00000001-0001-4001-8001-000000000001",
          user_id: "11111111-1111-4111-8111-111111111111",
          company_id: null,
          location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          date: "2026-02-03",
          status: "ACTIVE",
          slot: "lunch",
        },
        {
          id: "00000002-0002-4002-8002-000000000002",
          user_id: "22222222-2222-4222-8222-222222222222",
          company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          location_id: null,
          date: "2026-02-03",
          status: "ACTIVE",
          slot: "lunch",
        },
        {
          id: "00000003-0003-4003-8003-000000000003",
          user_id: null,
          company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          date: "2026-02-03",
          status: "ACTIVE",
          slot: "lunch",
        },
      ],
    });

    const req = mkReq("http://localhost/api/kitchen?date=2026-02-03", { method: "GET" });
    const res = await kitchenGET(req);

    expect(res.status).toBe(200);
    const body = await readJson(res);

    expect(body?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(body);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows", "reason"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expect(body?.data?.summary?.orders).toBe(0);
    expect(body?.data?.rows ?? []).toHaveLength(0);
    expect(body?.data?.reason).toBe("NO_ORDERS");
    expect(body?.data?.summary?.companies).toBe(0);
    expect(body?.data?.summary?.people).toBe(0);
    expect(body?.data?.production_operative_snapshot).toBeUndefined();
    expectKitchenRowsCanonicallySorted(body?.data?.rows ?? []);
  });

  test("excludes ACTIVE order when matching day_choices row is CANCELLED (operativ avstemming)", async () => {
    adminDb = makeAdminMock({
      orders: [
        {
          id: "00000001-0001-4001-8001-000000000001",
          user_id: "11111111-1111-4111-8111-111111111111",
          company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          date: "2026-02-03",
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [
        {
          user_id: "11111111-1111-4111-8111-111111111111",
          company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          date: "2026-02-03",
          choice_key: "salatbar",
          note: null,
          updated_at: "2026-02-02T12:00:00Z",
          status: "CANCELLED",
        },
      ],
    });

    const req = mkReq("http://localhost/api/kitchen?date=2026-02-03", { method: "GET" });
    const res = await kitchenGET(req);

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(body);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows", "reason"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expect(body?.data?.summary?.orders).toBe(0);
    expect(body?.data?.rows ?? []).toHaveLength(0);
    expect(body?.data?.reason).toBe("NO_ORDERS");
    expect(body?.data?.summary?.companies).toBe(0);
    expect(body?.data?.summary?.people).toBe(0);
    expect(body?.data?.production_operative_snapshot).toBeUndefined();
    expectKitchenRowsCanonicallySorted(body?.data?.rows ?? []);
  });

  test("live: day_choices med choice_key brukes på ordre uten note (dcMap → menu_title)", async () => {
    adminDb = makeAdminMock({
      ...kSupport,
      orders: [
        {
          id: K_O1,
          user_id: K_U1,
          company_id: K_CID,
          location_id: K_LID,
          date: K_DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [
        {
          user_id: K_U1,
          company_id: K_CID,
          location_id: K_LID,
          date: K_DATE,
          choice_key: "salatbar",
          note: null,
          updated_at: "2026-02-02T10:00:00Z",
          status: "ACTIVE",
        },
      ],
    });

    const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    const row = (body?.data?.rows ?? []).find((r: any) => r.orderId === K_O1);
    expect(row).toBeTruthy();
    expect(String(row.menu_title ?? "").toLowerCase()).toContain("salatbar");
  });

  test("live: day_choices for annen user_id gir ikke valg på ordre for første bruker", async () => {
    adminDb = makeAdminMock({
      ...kSupport,
      orders: [
        {
          id: K_O1,
          user_id: K_U1,
          company_id: K_CID,
          location_id: K_LID,
          date: K_DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: K_O2,
          user_id: K_U2,
          company_id: K_CID,
          location_id: K_LID,
          date: K_DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [
        {
          user_id: K_U2,
          company_id: K_CID,
          location_id: K_LID,
          date: K_DATE,
          choice_key: "salatbar",
          note: null,
          updated_at: "2026-02-02T10:00:00Z",
          status: "ACTIVE",
        },
      ],
    });

    const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expectKitchenJsonEnvelopeOk(body);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    const r1 = (body?.data?.rows ?? []).find((r: any) => r.orderId === K_O1);
    const r2 = (body?.data?.rows ?? []).find((r: any) => r.orderId === K_O2);
    expect(r1 && r2).toBeTruthy();
    expect(String(r1.menu_title ?? "").toLowerCase()).not.toContain("salatbar");
    expect(String(r2.menu_title ?? "").toLowerCase()).toContain("salatbar");
  });

  test("frozen snapshot: samme menu_title + kitchenRowParityPayload-invarianter per orderId vs live (allowlist kun mengde)", async () => {
    const orders = [
      {
        id: K_O1,
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
      {
        id: K_O2,
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];
    const day_choices = [
      {
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        choice_key: "basis",
        note: null,
        updated_at: "2026-02-02T09:00:00Z",
        status: "ACTIVE",
      },
      {
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        choice_key: "luxus",
        note: null,
        updated_at: "2026-02-02T09:30:00Z",
        status: "ACTIVE",
      },
    ];

    adminDb = makeAdminMock({
      ...kSupport,
      orders,
      day_choices,
      production_operative_snapshots: [],
    });
    const liveRes = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    const liveBody = await readJson(liveRes);
    expectKitchenJsonEnvelopeOk(liveBody);
    expect(new Set(Object.keys(liveBody?.data ?? {}))).toEqual(new Set(["date", "summary", "rows"]));
    expectKitchenSummaryShapeMin(liveBody?.data?.summary);
    expect(liveBody?.data?.production_operative_snapshot).toBeUndefined();
    expect(liveBody?.data?.reason).toBeUndefined();
    const liveRows0 = liveBody?.data?.rows ?? [];
    expectKitchenSummaryInvariantsFromRows(liveRows0, liveBody?.data?.summary);
    expectKitchenRowsCanonicallySorted(liveRows0);
    expectKitchenRowsSingleDeliveryBucket(liveRows0, { slot: "lunch", company: "TestCo", location: "Loc1" });
    expect(liveRows0.map((r: any) => r.orderId)).toEqual([K_O1, K_O2]);
    for (const r of liveRows0) expectKitchenRowFieldContract(r);
    const liveTitle = (liveBody?.data?.rows ?? []).find((r: any) => r.orderId === K_O1)?.menu_title;

    adminDb = makeAdminMock({
      ...kSupport,
      orders,
      day_choices,
      production_operative_snapshots: [
        {
          delivery_date: K_DATE,
          company_id: K_CID,
          order_ids: [K_O1],
          frozen_at: "2026-02-03T08:00:00.000Z",
        },
      ],
    });
    const frRes = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    const frBody = await readJson(frRes);
    expect(frBody?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(frBody);
    expect(new Set(Object.keys(frBody?.data ?? {}))).toEqual(
      new Set(["date", "summary", "rows", "production_operative_snapshot"]),
    );
    expectKitchenSummaryShapeMin(frBody?.data?.summary);
    expectKitchenSnapshotMetaShapeMin(frBody?.data?.production_operative_snapshot);
    expect(frBody?.data?.production_operative_snapshot?.active).toBe(true);
    expect(frBody?.data?.production_operative_snapshot?.frozen_at).toBe("2026-02-03T08:00:00.000Z");
    expect((frBody?.data?.rows ?? []).length).toBe(1);
    expect(frBody?.data?.production_operative_snapshot?.captured_order_ids).toBe(
      (frBody?.data?.rows ?? []).length,
    );
    expect((frBody?.data?.rows ?? []).map((r: any) => r.orderId)).toEqual([K_O1]);
    expect(frBody?.data?.reason).toBeUndefined();
    const frRows0 = frBody?.data?.rows ?? [];
    expectKitchenSummaryInvariantsFromRows(frRows0, frBody?.data?.summary);
    expectKitchenRowsCanonicallySorted(frBody?.data?.rows ?? []);
    expectKitchenRowsSingleDeliveryBucket(frRows0, { slot: "lunch", company: "TestCo", location: "Loc1" });
    const frTitle = (frBody?.data?.rows ?? []).find((r: any) => r.orderId === K_O1)?.menu_title;
    expect(frTitle).toBe(liveTitle);
    expectKitchenFrozenRowsFieldParityWithLive(liveRows0, frRows0);
  });

  test("NOT_DELIVERY_DAY (helg): reason før snapshot; ingen freeze-meta; summary/rows tom", async () => {
    const sat = "2026-02-07";
    adminDb = makeAdminMock({
      ...kSupport,
      orders: [
        {
          id: K_O1,
          user_id: K_U1,
          company_id: K_CID,
          location_id: K_LID,
          date: sat,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: sat,
          company_id: K_CID,
          order_ids: [K_O1],
          frozen_at: `${sat}T08:00:00.000Z`,
        },
      ],
    });
    const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${sat}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(body);
    expect(body?.data?.reason).toBe("NOT_DELIVERY_DAY");
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows", "reason"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expect(body?.data?.summary?.orders).toBe(0);
    expect(body?.data?.summary?.companies).toBe(0);
    expect(body?.data?.summary?.people).toBe(0);
    expect((body?.data?.rows ?? []).length).toBe(0);
    expect(body?.data?.production_operative_snapshot).toBeUndefined();
    expectKitchenRowsCanonicallySorted(body?.data?.rows ?? []);
  });

  test("live-path: ingen operative ordre for leveringsdag — NO_ORDERS, rows [], summary 0, ingen production_operative_snapshot", async () => {
    adminDb = makeAdminMock({
      ...kSupport,
      orders: [],
      day_choices: [],
      production_operative_snapshots: [],
    });
    const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(body);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows", "reason"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expect(body?.data?.date).toBe(K_DATE);
    expect(body?.data?.reason).toBe("NO_ORDERS");
    const rows = body?.data?.rows ?? [];
    expect(rows.length).toBe(0);
    expect(body?.data?.summary?.orders).toBe(0);
    expect(body?.data?.summary?.companies).toBe(0);
    expect(body?.data?.summary?.people).toBe(0);
    expectKitchenSummaryInvariantsFromRows(rows, body?.data?.summary);
    expect(body?.data?.production_operative_snapshot).toBeUndefined();
    expectKitchenRowsCanonicallySorted(rows);
  });

  test("live-path: ingen snapshot-rad — production_operative_snapshot undefined, full operative rader, ingen NO_ORDERS", async () => {
    const orders = [
      {
        id: K_O1,
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
      {
        id: K_O2,
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];
    adminDb = makeAdminMock({
      ...kSupport,
      orders,
      day_choices: [],
      production_operative_snapshots: [],
    });
    const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(body);
    expect(body?.data?.date).toBe(K_DATE);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expect(body?.data?.production_operative_snapshot).toBeUndefined();
    expect(body?.data?.reason).toBeUndefined();
    const rowsLp = body?.data?.rows ?? [];
    expectKitchenSummaryInvariantsFromRows(rowsLp, body?.data?.summary);
    expectKitchenRowsCanonicallySorted(rowsLp);
    expectKitchenRowsSingleDeliveryBucket(rowsLp, { slot: "lunch", company: "TestCo", location: "Loc1" });
    expect(rowsLp.map((r: any) => r.orderId)).toEqual([K_O1, K_O2]);
    for (const r of rowsLp) expectKitchenRowFieldContract(r);
  });

  test("read-contract: snapshot kun for annen delivery_date enn ?date → ingen freeze-meta; rader = full live for valgt dato", async () => {
    const orders = [
      {
        id: K_O1,
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
      {
        id: K_O2,
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];
    adminDb = makeAdminMock({
      ...kSupport,
      orders,
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: "2026-02-10",
          company_id: K_CID,
          order_ids: [K_O1],
          frozen_at: "2026-02-10T08:00:00.000Z",
        },
      ],
    });
    const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expectKitchenJsonEnvelopeOk(body);
    expect(body?.data?.reason).toBeUndefined();
    expect(body?.data?.production_operative_snapshot).toBeUndefined();
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    const rowsWd = body?.data?.rows ?? [];
    expectKitchenSummaryInvariantsFromRows(rowsWd, body?.data?.summary);
    expectKitchenRowsCanonicallySorted(rowsWd);
    expectKitchenRowsSingleDeliveryBucket(rowsWd, { slot: "lunch", company: "TestCo", location: "Loc1" });
    expect(rowsWd.map((r: any) => r.orderId)).toEqual([K_O1, K_O2]);
    for (const r of rowsWd) expectKitchenRowFieldContract(r);
  });

  test("frozen tom allowlist (snapshot order_ids: []): NO_ORDERS, ingen rader — ingen falsk frozen-menu fra operative seed", async () => {
    const orders = [
      {
        id: K_O1,
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
      {
        id: K_O2,
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];
    adminDb = makeAdminMock({
      ...kSupport,
      orders,
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: K_DATE,
          company_id: K_CID,
          order_ids: [],
          frozen_at: "2026-02-03T08:00:00.000Z",
        },
      ],
    });
    const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(body);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows", "reason"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expect(body?.data?.date).toBe(K_DATE);
    expect(body?.data?.summary?.orders).toBe(0);
    expect(body?.data?.summary?.companies).toBe(0);
    expect(body?.data?.summary?.people).toBe(0);
    expect(body?.data?.reason).toBe("NO_ORDERS");
    expect((body?.data?.rows ?? []).length).toBe(0);
    expectKitchenSummaryInvariantsFromRows(body?.data?.rows ?? [], body?.data?.summary);
    // NO_ORDERS-early-return utelater freeze-meta: ingen active:true uten rader (canonical — ikke falsk frozen-signal)
    expect(body?.data?.production_operative_snapshot).toBeUndefined();
  });

  test("kitchen HTTP: snapshot order_ids null (korrupt) → samme NO_ORDERS+data-keys som tom allowlist; ingen freeze-meta", async () => {
    const orders = [
      {
        id: K_O1,
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
      {
        id: K_O2,
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];
    adminDb = makeAdminMock({
      ...kSupport,
      orders,
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: K_DATE,
          company_id: K_CID,
          order_ids: null,
          frozen_at: "2026-02-03T08:00:00.000Z",
        },
      ],
    });
    const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(body);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows", "reason"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expect(body?.data?.reason).toBe("NO_ORDERS");
    expect(body?.data?.summary?.orders).toBe(0);
    expect(body?.data?.summary?.companies).toBe(0);
    expect(body?.data?.summary?.people).toBe(0);
    expect((body?.data?.rows ?? []).length).toBe(0);
    expectKitchenSummaryInvariantsFromRows(body?.data?.rows ?? [], body?.data?.summary);
    expect(body?.data?.production_operative_snapshot).toBeUndefined();
    expectKitchenRowsCanonicallySorted(body?.data?.rows ?? []);
  });

  test("NO_ORDERS empty-state parity: live (ingen ordre), frozen (order_ids []), korrupt (order_ids null) — identisk date/reason/summary/rows", async () => {
    const baseOrders = [
      {
        id: K_O1,
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
      {
        id: K_O2,
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];
    const cases = [
      { orders: [] as any[], snapshots: [] as any[] },
      {
        orders: baseOrders,
        snapshots: [
          {
            delivery_date: K_DATE,
            company_id: K_CID,
            order_ids: [],
            frozen_at: "2026-02-03T08:00:00.000Z",
          },
        ],
      },
      {
        orders: baseOrders,
        snapshots: [
          {
            delivery_date: K_DATE,
            company_id: K_CID,
            order_ids: null,
            frozen_at: "2026-02-03T08:00:00.000Z",
          },
        ],
      },
    ];
    const norms: string[] = [];
    for (const c of cases) {
      adminDb = makeAdminMock({
        ...kSupport,
        orders: c.orders,
        day_choices: [],
        production_operative_snapshots: c.snapshots,
      });
      const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
      expect(res.status).toBe(200);
      const body = await readJson(res);
      expect(body?.ok).toBe(true);
      expect(body?.data?.reason).toBe("NO_ORDERS");
      expect(body?.data?.production_operative_snapshot).toBeUndefined();
      norms.push(
        JSON.stringify({
          date: body?.data?.date,
          reason: body?.data?.reason,
          summary: body?.data?.summary,
          rows: body?.data?.rows,
        }),
      );
    }
    expect(norms[0]).toBe(norms[1]);
    expect(norms[1]).toBe(norms[2]);
  });

  test("re-materialisert utvidet snapshot: samme operative ordre i DB, oppdatert order_ids reflekteres i frozen rows (ingen stale)", async () => {
    const orders = [
      {
        id: K_O1,
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
      {
        id: K_O2,
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];
    const day_choices = [
      {
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        choice_key: "basis",
        note: null,
        updated_at: "2026-02-02T09:00:00Z",
        status: "ACTIVE",
      },
      {
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        choice_key: "luxus",
        note: null,
        updated_at: "2026-02-02T09:30:00Z",
        status: "ACTIVE",
      },
    ];

    adminDb = makeAdminMock({
      ...kSupport,
      orders,
      day_choices,
      production_operative_snapshots: [],
    });
    const liveRef = await readJson(await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" })));
    expectKitchenJsonEnvelopeOk(liveRef);
    const twoRowLiveOrder = (liveRef?.data?.rows ?? []).map((r: any) => r.orderId);
    expectKitchenRowsCanonicallySorted(liveRef?.data?.rows ?? []);
    expect(twoRowLiveOrder).toEqual([K_O1, K_O2]);

    adminDb = makeAdminMock({
      ...kSupport,
      orders,
      day_choices,
      production_operative_snapshots: [
        {
          delivery_date: K_DATE,
          company_id: K_CID,
          order_ids: [K_O1],
          frozen_at: "2026-02-03T08:00:00.000Z",
        },
      ],
    });
    const narrow = await readJson(await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" })));
    expectKitchenJsonEnvelopeOk(narrow);
    expect(new Set(Object.keys(narrow?.data ?? {}))).toEqual(
      new Set(["date", "summary", "rows", "production_operative_snapshot"]),
    );
    expectKitchenSummaryShapeMin(narrow?.data?.summary);
    expectKitchenSnapshotMetaShapeMin(narrow?.data?.production_operative_snapshot);
    expect(narrow?.data?.production_operative_snapshot?.active).toBe(true);
    expect(narrow?.data?.production_operative_snapshot?.captured_order_ids).toBe(1);
    expect((narrow?.data?.rows ?? []).length).toBe(1);
    expectKitchenRowsCanonicallySorted(narrow?.data?.rows ?? []);
    expect((narrow?.data?.rows ?? []).map((r: any) => r.orderId)).toEqual([K_O1]);
    for (const r of narrow?.data?.rows ?? []) expectKitchenRowFieldContract(r);
    expectKitchenFrozenRowsFieldParityWithLive(liveRef?.data?.rows ?? [], narrow?.data?.rows ?? []);

    adminDb = makeAdminMock({
      ...kSupport,
      orders,
      day_choices,
      production_operative_snapshots: [
        {
          delivery_date: K_DATE,
          company_id: K_CID,
          // Bevisst motsatt rekkefølge vs. canonical rows.sort — presentasjon følger ikke allowlist-arrayets orden
          order_ids: [K_O2, K_O1],
          frozen_at: "2026-02-03T09:00:00.000Z",
        },
      ],
    });
    const wide = await readJson(await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" })));
    expectKitchenJsonEnvelopeOk(wide);
    expect(new Set(Object.keys(wide?.data ?? {}))).toEqual(
      new Set(["date", "summary", "rows", "production_operative_snapshot"]),
    );
    expectKitchenSummaryShapeMin(wide?.data?.summary);
    expectKitchenSnapshotMetaShapeMin(wide?.data?.production_operative_snapshot);
    expect(wide?.data?.production_operative_snapshot?.active).toBe(true);
    expect(wide?.data?.production_operative_snapshot?.captured_order_ids).toBe(2);
    expect((wide?.data?.rows ?? []).length).toBe(2);
    const wideIds = new Set((wide?.data?.rows ?? []).map((r: any) => r.orderId));
    expect(wideIds.has(K_O1) && wideIds.has(K_O2)).toBe(true);
    expectKitchenRowsCanonicallySorted(wide?.data?.rows ?? []);
    expectKitchenRowsSingleDeliveryBucket(wide?.data?.rows ?? [], { slot: "lunch", company: "TestCo", location: "Loc1" });
    expect((wide?.data?.rows ?? []).map((r: any) => r.orderId)).toEqual(twoRowLiveOrder);
    for (const r of wide?.data?.rows ?? []) expectKitchenRowFieldContract(r);
    expectKitchenFrozenRowsFieldParityWithLive(liveRef?.data?.rows ?? [], wide?.data?.rows ?? []);
  });

  test("korrupt dobbel snapshot-rad samme company_id+delivery_date: limit(1) treffer første rad — frozen følger den (determinisme som speiler fetch uten ORDER BY)", async () => {
    const orders = [
      {
        id: K_O1,
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
      {
        id: K_O2,
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];
    const day_choices = [
      {
        user_id: K_U1,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        choice_key: "basis",
        note: null,
        updated_at: "2026-02-02T09:00:00Z",
        status: "ACTIVE",
      },
      {
        user_id: K_U2,
        company_id: K_CID,
        location_id: K_LID,
        date: K_DATE,
        choice_key: "luxus",
        note: null,
        updated_at: "2026-02-02T09:30:00Z",
        status: "ACTIVE",
      },
    ];

    adminDb = makeAdminMock({
      ...kSupport,
      orders,
      day_choices,
      production_operative_snapshots: [
        {
          delivery_date: K_DATE,
          company_id: K_CID,
          order_ids: [K_O1],
          frozen_at: "2026-02-03T08:00:00.000Z",
        },
        {
          delivery_date: K_DATE,
          company_id: K_CID,
          order_ids: [K_O1, K_O2],
          frozen_at: "2026-02-03T09:00:00.000Z",
        },
      ],
    });
    const body = await readJson(await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" })));
    expectKitchenJsonEnvelopeOk(body);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(
      new Set(["date", "summary", "rows", "production_operative_snapshot"]),
    );
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expectKitchenSnapshotMetaShapeMin(body?.data?.production_operative_snapshot);
    expect(body?.data?.production_operative_snapshot?.active).toBe(true);
    expect(body?.data?.production_operative_snapshot?.captured_order_ids).toBe(1);
    expect((body?.data?.rows ?? []).length).toBe(1);
    expect((body?.data?.rows ?? [])[0]?.orderId).toBe(K_O1);
    const matRows = body?.data?.rows ?? [];
    expectKitchenSummaryInvariantsFromRows(matRows, body?.data?.summary);
    expectKitchenRowsCanonicallySorted(matRows);
    expectKitchenRowsSingleDeliveryBucket(matRows, { slot: "lunch", company: "TestCo", location: "Loc1" });
    for (const r of matRows) expectKitchenRowFieldContract(r);
  });

  test("annen tenants snapshot-rad styrer ikke freeze for kjøkkens firma; ingen cross-company rows", async () => {
    adminDb = makeAdminMock({
      companies: [
        { id: K_CID, name: "TestCo", agreement_json: null },
        { id: K_CID_OTHER, name: "Annet AS", agreement_json: null },
      ],
      company_locations: [
        { id: K_LID, name: "Loc1", company_id: K_CID },
        { id: K_LID_OTHER, name: "LocAnnen", company_id: K_CID_OTHER },
      ],
      profiles: kSupport.profiles,
      orders: [
        {
          id: K_O1,
          user_id: K_U1,
          company_id: K_CID,
          location_id: K_LID,
          date: K_DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: K_O_OTHER,
          user_id: K_U_OTHER,
          company_id: K_CID_OTHER,
          location_id: K_LID_OTHER,
          date: K_DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: "fremmed",
        },
      ],
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: K_DATE,
          company_id: K_CID_OTHER,
          order_ids: [K_O_OTHER],
          frozen_at: "2026-02-03T07:00:00.000Z",
        },
      ],
    });

    const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(body);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "summary", "rows"]));
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expect(body?.data?.production_operative_snapshot?.active).toBeFalsy();
    const ids = new Set((body?.data?.rows ?? []).map((r: any) => r.orderId));
    expect(ids.has(K_O1)).toBe(true);
    expect(ids.has(K_O_OTHER)).toBe(false);
    expect((body?.data?.rows ?? []).length).toBe(1);
    const tenantOnlyRows = body?.data?.rows ?? [];
    expectKitchenRowsCanonicallySorted(tenantOnlyRows);
    expectKitchenRowsSingleDeliveryBucket(tenantOnlyRows, { slot: "lunch", company: "TestCo", location: "Loc1" });
    expect(tenantOnlyRows.map((r: any) => r.orderId)).toEqual([K_O1]);
    for (const r of tenantOnlyRows) expectKitchenRowFieldContract(r);
  });

  test("frozen: allowlist med id fra annet firma gir ikke fremmed ordre-rad (snitt med operative for kjøkkens scope)", async () => {
    adminDb = makeAdminMock({
      companies: [
        { id: K_CID, name: "TestCo", agreement_json: null },
        { id: K_CID_OTHER, name: "Annet AS", agreement_json: null },
      ],
      company_locations: [
        { id: K_LID, name: "Loc1", company_id: K_CID },
        { id: K_LID_OTHER, name: "LocAnnen", company_id: K_CID_OTHER },
      ],
      profiles: kSupport.profiles,
      orders: [
        {
          id: K_O1,
          user_id: K_U1,
          company_id: K_CID,
          location_id: K_LID,
          date: K_DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: K_O_OTHER,
          user_id: K_U_OTHER,
          company_id: K_CID_OTHER,
          location_id: K_LID_OTHER,
          date: K_DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: K_DATE,
          company_id: K_CID,
          order_ids: [K_O1, K_O_OTHER],
          frozen_at: "2026-02-03T08:00:00.000Z",
        },
      ],
    });

    const res = await kitchenGET(mkReq(`http://localhost/api/kitchen?date=${K_DATE}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    expectKitchenJsonEnvelopeOk(body);
    expect(new Set(Object.keys(body?.data ?? {}))).toEqual(
      new Set(["date", "summary", "rows", "production_operative_snapshot"]),
    );
    expectKitchenSummaryShapeMin(body?.data?.summary);
    expectKitchenSnapshotMetaShapeMin(body?.data?.production_operative_snapshot);
    expect(body?.data?.production_operative_snapshot?.active).toBe(true);
    expect((body?.data?.rows ?? []).length).toBe(1);
    expect((body?.data?.rows ?? [])[0]?.orderId).toBe(K_O1);
    const snRows = body?.data?.rows ?? [];
    expectKitchenSummaryInvariantsFromRows(snRows, body?.data?.summary);
    expectKitchenRowsCanonicallySorted(snRows);
    expectKitchenRowsSingleDeliveryBucket(snRows, { slot: "lunch", company: "TestCo", location: "Loc1" });
    for (const r of snRows) expectKitchenRowFieldContract(r);
  });
});
