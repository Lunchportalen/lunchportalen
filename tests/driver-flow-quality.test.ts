// tests/driver-flow-quality.test.ts
// @ts-nocheck
/** Driver stops + CSV følger loadOperativeKitchenOrders (samme operative sannhet som kjøkken). */
import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}

const DRIVER_AUTH = "11111111-1111-4111-8111-111111111111";
const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const U1 = "22222222-2222-4222-8222-222222222222";
const U2 = "33333333-3333-4333-8333-333333333333";
const U3 = "44444444-4444-4444-8444-444444444444";
const O1 = "00000001-0001-4001-8001-000000000001";
const O2 = "00000002-0002-4002-8002-000000000002";
const O3 = "00000003-0003-4003-8003-000000000003";
const O4 = "00000004-0004-4004-8004-000000000004";

let eqCalls: Array<{ table: string; key: string; value: string }> = [];
let inCalls: Array<{ table: string; key: string; values: any[] }> = [];

type Seed = {
  orders?: any[];
  day_choices?: any[];
  production_operative_snapshots?: any[];
  companies?: any[];
  company_locations?: any[];
  profiles?: any[];
  delivery_confirmations?: any[];
};

let seed: Required<Seed> = {
  orders: [],
  day_choices: [],
  production_operative_snapshots: [],
  companies: [],
  company_locations: [],
  profiles: [],
  delivery_confirmations: [],
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

function createAdmin() {
  return {
    from(table: string) {
      const base = [...(((seed as any)[table] as any[]) ?? [])];
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
          inCalls.push({ table, key: k, values: arr });
          return q;
        },
        limit: (n: number) => {
          st.limitN = n;
          return q;
        },
        order: () => q,
        maybeSingle: async () => {
          const rows = applyFilters(base, st.filters, st.ins, st.limitN);
          const row = rows[0] ?? null;
          if (table === "profiles") {
            return { data: row, error: null };
          }
          return { data: row, error: null };
        },
        upsert: (payload: any) => ({
          select: () => ({
            maybeSingle: async () => ({
              data: {
                ...payload,
                id: "conf1",
                confirmed_at: (payload?.delivery_date ?? "") + "T10:00:00Z",
                confirmed_by: payload?.confirmed_by ?? DRIVER_AUTH,
              },
              error: null,
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

let adminSingleton: ReturnType<typeof createAdmin> | null = null;
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
          userId: DRIVER_AUTH,
          role: "driver",
          companyId: CID,
          locationId: LID,
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
    auth: {
      getUser: async () => ({
        data: { user: { id: DRIVER_AUTH, email: "driver.test@lunchportalen.no" } },
        error: null,
      }),
    },
    from: (t: string) => getAdmin().from(t),
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

/** Speiler `stops.sort` i app/api/driver/stops/route.ts (deterministisk stopp-rekkefølge). */
function expectDriverStopsCanonicallySorted(stops: any[]) {
  const list = Array.isArray(stops) ? stops : [];
  const sorted = [...list].sort((x, y) => {
    if (x.slot !== y.slot) return String(x.slot ?? "").localeCompare(String(y.slot ?? ""), "nb");
    if ((x.locationName ?? "") !== (y.locationName ?? "")) {
      return String(x.locationName ?? "").localeCompare(String(y.locationName ?? ""), "nb");
    }
    return String(x.companyName ?? "").localeCompare(String(y.companyName ?? ""), "nb");
  });
  expect(list.map((s) => s.key)).toEqual(sorted.map((s) => s.key));
}

function driverStopsOrderSig(stops: any[]) {
  return (stops ?? []).map(
    (s) => `${String(s.slot ?? "")}|${s.locationName ?? ""}|${s.companyName ?? ""}|${s.key}`,
  );
}

/** Fasit: Stop i app/api/driver/stops/route.ts (JSON har alle nøkler). */
const DRIVER_STOP_CONTRACT_KEYS = [
  "addressLine",
  "companyId",
  "companyName",
  "date",
  "delivered",
  "deliveredAt",
  "deliveredBy",
  "deliveryContactName",
  "deliveryContactPhone",
  "deliveryWhenNote",
  "deliveryWhere",
  "deliveryWindowFrom",
  "deliveryWindowTo",
  "key",
  "locationId",
  "locationName",
  "orderCount",
  "slot",
].sort();

function expectDriverStopFieldContract(stop: any) {
  expect(Object.keys(stop).sort()).toEqual(DRIVER_STOP_CONTRACT_KEYS);
}

function driverStopParityPayload(stop: any) {
  return {
    key: stop.key,
    date: stop.date,
    slot: stop.slot,
    companyId: stop.companyId,
    companyName: stop.companyName ?? null,
    locationId: stop.locationId,
    locationName: stop.locationName ?? null,
    addressLine: stop.addressLine ?? null,
    deliveryWhere: stop.deliveryWhere ?? null,
    deliveryWhenNote: stop.deliveryWhenNote ?? null,
    deliveryContactName: stop.deliveryContactName ?? null,
    deliveryContactPhone: stop.deliveryContactPhone ?? null,
    deliveryWindowFrom: stop.deliveryWindowFrom ?? null,
    deliveryWindowTo: stop.deliveryWindowTo ?? null,
    orderCount: stop.orderCount,
    delivered: stop.delivered,
    deliveredAt: stop.deliveredAt ?? null,
    deliveredBy: stop.deliveredBy ?? null,
  };
}

/**
 * Samme stopp-nøkkel → identisk driverStopParityPayload (operative felt: firma/lokasjon/slot/adresse/leveringsfelter/orderCount i bucket).
 * Allowlist endrer kun hvilke ordre som telles (orderCount / antall stopp), ikke semantikk i felt for samme stopp.
 */
function expectDriverStopsFieldParityByKey(live: any[], frozen: any[]) {
  const liveByKey = new Map((live ?? []).map((s) => [s.key, s]));
  expect(frozen.length).toBe(live.length);
  for (const fr of frozen ?? []) {
    const lv = liveByKey.get(fr.key);
    expect(lv).toBeTruthy();
    expectDriverStopFieldContract(fr);
    expectDriverStopFieldContract(lv);
    expect(driverStopParityPayload(fr)).toEqual(driverStopParityPayload(lv));
  }
}

/** Σ orderCount på stopp = antall operative ordre i scoped svar (én bucket → én sum). */
function expectDriverStopsOrderCountSumInvariant(stops: any[], expectedTotalOrders: number) {
  const sum = (stops ?? []).reduce((a, s) => a + (s.orderCount ?? 0), 0);
  expect(sum).toBe(expectedTotalOrders);
}

/**
 * jsonOk-konvolutt + data: kun date + stops — ingen snapshot-/reason-meta i driver (app/api/driver/stops/route.ts).
 * Kitchen har annen data-projection (summary/rows/production_operative_snapshot); ikke forveksle rutene.
 */
function expectDriverStopsJsonEnvelope(body: any) {
  expect(Object.keys(body ?? {}).sort()).toEqual(["data", "ok", "rid"].sort());
  expect(new Set(Object.keys(body?.data ?? {}))).toEqual(new Set(["date", "stops"]));
  expect((body as any)?.reason).toBeUndefined();
  expect((body?.data as any)?.reason).toBeUndefined();
}

/** Speiler stop-aggregering: én bucket per `date|norm(slot)|companyId|locationId` (app/api/driver/stops/route.ts). */
function expectDriverStopsBucketTenancy(stops: any[], dayIso: string, companyId: string, locationId: string) {
  const list = Array.isArray(stops) ? stops : [];
  const keys = new Set(list.map((s) => s.key));
  expect(keys.size).toBe(list.length);
  for (const s of list) {
    expect(s.companyId).toBe(companyId);
    expect(s.locationId).toBe(locationId);
    const slot = String(s.slot ?? "").toLowerCase();
    expect(s.key).toBe(`${dayIso}|${slot}|${companyId}|${locationId}`);
  }
}

const defaultProfiles = [
  {
    id: DRIVER_AUTH,
    user_id: DRIVER_AUTH,
    company_id: CID,
    location_id: LID,
    disabled_at: null,
    is_active: true,
  },
];

const defaultCompanies = [{ id: CID, name: "TestCo" }];
const defaultLocations = [
  {
    id: LID,
    company_id: CID,
    name: "Loc1",
    address_line1: "Gate 1",
    city: "Oslo",
    postal_code: "0001",
  },
];

beforeEach(() => {
  eqCalls = [];
  inCalls = [];
  adminSingleton = null;
  resetSeed({
    profiles: defaultProfiles,
    companies: defaultCompanies,
    company_locations: defaultLocations,
  });
});

function stopsDeliveryShape(stops: any[]) {
  return [...stops]
    .map((s) => ({
      key: s.key,
      date: s.date,
      slot: s.slot,
      companyId: s.companyId,
      locationId: s.locationId,
      orderCount: s.orderCount,
      companyName: s.companyName ?? null,
      locationName: s.locationName ?? null,
      delivered: s.delivered,
      deliveredAt: s.deliveredAt ?? null,
    }))
    .sort((a, b) => a.key.localeCompare(b.key, "nb"));
}

describe("driver day view – delivery truth", () => {
  test("operative stopp bygger på loadOperativeKitchenOrders: ACTIVE/active, ikke CANCELLED-rader; kansellert dagvalg fjerner ordre", async () => {
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders: [
        {
          id: O1,
          user_id: U1,
          date: "2026-02-02",
          slot: "08:00",
          status: "ACTIVE",
          company_id: CID,
          location_id: LID,
          note: null,
        },
        {
          id: O2,
          user_id: U1,
          date: "2026-02-02",
          slot: "08:00",
          status: "CANCELLED",
          company_id: CID,
          location_id: LID,
          note: null,
        },
        {
          id: O3,
          user_id: U2,
          date: "2026-02-02",
          slot: "08:00",
          status: "ACTIVE",
          company_id: CID,
          location_id: LID,
          note: null,
        },
        {
          id: O4,
          user_id: U3,
          date: "2026-02-02",
          slot: "08:00",
          status: "ACTIVE",
          company_id: CID,
          location_id: LID,
          note: null,
        },
      ],
      day_choices: [
        {
          user_id: U2,
          company_id: CID,
          location_id: LID,
          date: "2026-02-02",
          choice_key: "basis",
          note: null,
          updated_at: "2026-02-02T08:00:00Z",
          status: "CANCELLED",
        },
      ],
    });

    const req = mkReq("http://localhost/api/driver/stops?date=2026-02-02", { method: "GET" });
    const res = await driverStopsGET(req);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    expectDriverStopsJsonEnvelope(body);
    const stops = body?.data?.stops ?? body?.stops ?? [];
    expect(stops.length).toBe(1);
    expect(stops[0].orderCount).toBe(2);
    expectDriverStopsCanonicallySorted(stops);
    expectDriverStopsBucketTenancy(stops, "2026-02-02", CID, LID);
    expectDriverStopFieldContract(stops[0]);

    const statusIn = inCalls.find((c) => c.table === "orders" && c.key === "status");
    expect(statusIn?.values).toEqual(["ACTIVE", "active"]);
  });
});

describe("driver stops – live vs frozen (samme operative grunnlag som kitchen)", () => {
  const day = "2026-02-02";

  test("uten snapshot og med snapshot som dekker samme operative ordre-id: driverStopParityPayload-invarianter per stopp-nøkkel (allowlist kun mengde)", async () => {
    const orders = [
      {
        id: O1,
        user_id: U1,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        date: day,
        slot: "lunch",
        status: "active",
        company_id: CID,
        location_id: LID,
        note: "køkken-notat",
      },
    ];
    const day_choices = [
      {
        user_id: U1,
        company_id: CID,
        location_id: LID,
        date: day,
        choice_key: "basis",
        note: null,
        updated_at: `${day}T08:00:00Z`,
        status: "ACTIVE",
      },
      {
        user_id: U2,
        company_id: CID,
        location_id: LID,
        date: day,
        choice_key: "luxus",
        note: null,
        updated_at: `${day}T08:05:00Z`,
        status: "ACTIVE",
      },
    ];
    const base = {
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders,
      day_choices,
    };

    resetSeed({ ...base, production_operative_snapshots: [] });
    const resLive = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(resLive.status).toBe(200);
    const bodyLive = await readJson(resLive);
    expect(bodyLive?.ok).toBe(true);
    expectDriverStopsJsonEnvelope(bodyLive);
    expect(bodyLive?.data?.date).toBe(day);
    const liveStops = stopsDeliveryShape(bodyLive?.data?.stops ?? bodyLive?.stops ?? []);

    resetSeed({
      ...base,
      production_operative_snapshots: [
        {
          delivery_date: day,
          company_id: CID,
          order_ids: [O1, O2],
          frozen_at: `${day}T06:00:00Z`,
        },
      ],
    });

    const resFrozen = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(resFrozen.status).toBe(200);
    const bodyFrozen = await readJson(resFrozen);
    expect(bodyFrozen?.ok).toBe(true);
    expectDriverStopsJsonEnvelope(bodyFrozen);
    expect(bodyFrozen?.data?.date).toBe(day);
    const frozenStops = stopsDeliveryShape(bodyFrozen?.data?.stops ?? bodyFrozen?.stops ?? []);

    const snapEq = eqCalls.filter((c) => c.table === "production_operative_snapshots");
    expect(snapEq.some((c) => c.key === "delivery_date" && c.value === day)).toBe(true);
    expect(snapEq.some((c) => c.key === "company_id" && c.value === CID)).toBe(true);

    expect(frozenStops).toEqual(liveStops);
    expect(frozenStops.length).toBe(1);
    expect(frozenStops[0].orderCount).toBe(2);
    const rawLive = bodyLive?.data?.stops ?? bodyLive?.stops ?? [];
    const rawFrozen = bodyFrozen?.data?.stops ?? bodyFrozen?.stops ?? [];
    expectDriverStopsOrderCountSumInvariant(rawLive, 2);
    expectDriverStopsOrderCountSumInvariant(rawFrozen, 2);
    expectDriverStopsCanonicallySorted(rawLive);
    expectDriverStopsCanonicallySorted(rawFrozen);
    expect(driverStopsOrderSig(rawLive)).toEqual(driverStopsOrderSig(rawFrozen));
    expectDriverStopsBucketTenancy(rawLive, day, CID, LID);
    expectDriverStopsBucketTenancy(rawFrozen, day, CID, LID);
    expect(new Set(rawLive.map((s) => s.key))).toEqual(new Set(rawFrozen.map((s) => s.key)));
    expectDriverStopsFieldParityByKey(rawLive, rawFrozen);
  });

  test("read-contract: frozen GET bruker delivery_date+company_id i snapshot-oppslag (driver date låst til i dag — kryss-dato i loadOperativeKitchenOrders.test)", async () => {
    const orders = [
      {
        id: O1,
        user_id: U1,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
    ];
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders,
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: day,
          company_id: CID,
          order_ids: [O1],
          frozen_at: `${day}T06:00:00Z`,
        },
      ],
    });
    await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    const snapEq = eqCalls.filter((c) => c.table === "production_operative_snapshots");
    expect(snapEq.some((c) => c.key === "delivery_date" && c.value === day)).toBe(true);
    expect(snapEq.some((c) => c.key === "company_id" && c.value === CID)).toBe(true);
  });

  test("frozen tom allowlist (order_ids: []) — stops []; driver eksponerer ikke frozen-meta (kun date+stops); ingen falsk stopp ved operative seed", async () => {
    const orders = [
      {
        id: O1,
        user_id: U1,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
    ];
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders,
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: day,
          company_id: CID,
          order_ids: [],
          frozen_at: `${day}T06:00:00Z`,
        },
      ],
    });
    const res = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expectDriverStopsJsonEnvelope(body);
    const data = body?.data ?? body;
    const stops = data?.stops ?? [];
    expect(stops.length).toBe(0);
    expect(stops.reduce((a: number, s: any) => a + (s.orderCount ?? 0), 0)).toBe(0);
    expectDriverStopsCanonicallySorted(stops);
    expectDriverStopsBucketTenancy(stops, day, CID, LID);
    // Samme operative DB-grunnlag uten snapshot → live har stopp; tom allowlist er ikke stille fallback til full liste
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders,
      day_choices: [],
      production_operative_snapshots: [],
    });
    const resLive = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(resLive.status).toBe(200);
    const bodyLive = await readJson(resLive);
    expectDriverStopsJsonEnvelope(bodyLive);
    const liveStops = bodyLive?.data?.stops ?? bodyLive?.stops ?? [];
    expect(liveStops.length).toBeGreaterThan(0);
    for (const s of liveStops) expectDriverStopFieldContract(s);
  });

  test("live-path: ingen operative ordre — stops []; jsonOk kun date+stops; ingen frozen-meta eller reason", async () => {
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders: [],
      day_choices: [],
      production_operative_snapshots: [],
    });
    const res = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body?.ok).toBe(true);
    expectDriverStopsJsonEnvelope(body);
    const stops = body?.data?.stops ?? [];
    expect(stops.length).toBe(0);
    expectDriverStopsOrderCountSumInvariant(stops, 0);
    expectDriverStopsCanonicallySorted(stops);
    expectDriverStopsBucketTenancy(stops, day, CID, LID);
  });

  test("driver HTTP: snapshot order_ids null (korrupt) — stops [] som tom allowlist; samme envelope; ingen bleed", async () => {
    const orders = [
      {
        id: O1,
        user_id: U1,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
    ];
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders,
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: day,
          company_id: CID,
          order_ids: null,
          frozen_at: `${day}T06:00:00Z`,
        },
      ],
    });
    const res = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expectDriverStopsJsonEnvelope(body);
    const stops = body?.data?.stops ?? [];
    expect(stops.length).toBe(0);
    expectDriverStopsOrderCountSumInvariant(stops, 0);
    expectDriverStopsCanonicallySorted(stops);
    expectDriverStopsBucketTenancy(stops, day, CID, LID);
  });

  test("driver empty-state parity: live (ingen ordre), frozen tom allowlist, korrupt order_ids — identisk data.date + stops + konvolutt", async () => {
    const orders = [
      {
        id: O1,
        user_id: U1,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
    ];
    const cases = [
      { orders: [] as any[], snapshots: [] as any[] },
      {
        orders,
        snapshots: [
          {
            delivery_date: day,
            company_id: CID,
            order_ids: [],
            frozen_at: `${day}T06:00:00Z`,
          },
        ],
      },
      {
        orders,
        snapshots: [
          {
            delivery_date: day,
            company_id: CID,
            order_ids: null,
            frozen_at: `${day}T06:00:00Z`,
          },
        ],
      },
    ];
    const norms: string[] = [];
    for (const c of cases) {
      resetSeed({
        profiles: defaultProfiles,
        companies: defaultCompanies,
        company_locations: defaultLocations,
        orders: c.orders,
        day_choices: [],
        production_operative_snapshots: c.snapshots,
      });
      const res = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
      expect(res.status).toBe(200);
      const body = await readJson(res);
      expectDriverStopsJsonEnvelope(body);
      norms.push(JSON.stringify({ date: body?.data?.date, stops: body?.data?.stops ?? [] }));
    }
    expect(norms[0]).toBe(norms[1]);
    expect(norms[1]).toBe(norms[2]);
  });

  test("cross-company seed: stopp inkluderer ikke annet firmas ordre (live og frozen)", async () => {
    const CID_OTHER = "dddddddd-dddd-4000-8000-dddddddddddd";
    const LID_OTHER = "eeeeeeee-eeee-4000-8000-eeeeeeeeeeee";
    const U_OTHER = "66666666-6666-4666-8666-666666666666";
    const O_OTHER = "0000000b-000b-400b-800b-00000000000b";

    const orders = [
      {
        id: O1,
        user_id: U1,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O_OTHER,
        user_id: U_OTHER,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID_OTHER,
        location_id: LID_OTHER,
        note: "annen-bedrift",
      },
    ];
    const companies = [...defaultCompanies, { id: CID_OTHER, name: "OtherCo" }];
    const company_locations = [
      ...defaultLocations,
      {
        id: LID_OTHER,
        company_id: CID_OTHER,
        name: "Annen",
        address_line1: "X",
        city: "Bergen",
        postal_code: "5000",
      },
    ];

    resetSeed({
      profiles: defaultProfiles,
      companies,
      company_locations,
      orders,
      day_choices: [],
      production_operative_snapshots: [],
    });
    const resLive = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(resLive.status).toBe(200);
    const bodyLive = await readJson(resLive);
    expectDriverStopsJsonEnvelope(bodyLive);
    const liveStops = bodyLive?.data?.stops ?? bodyLive?.stops ?? [];
    expect(liveStops.length).toBe(1);
    expect(liveStops[0].companyId).toBe(CID);
    expect(liveStops[0].locationId).toBe(LID);
    expect(liveStops[0].orderCount).toBe(2);
    expect(liveStops.reduce((a: number, s: any) => a + s.orderCount, 0)).toBe(2);
    expectDriverStopFieldContract(liveStops[0]);

    resetSeed({
      profiles: defaultProfiles,
      companies,
      company_locations,
      orders,
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: day,
          company_id: CID,
          order_ids: [O1, O2],
          frozen_at: `${day}T06:00:00Z`,
        },
      ],
    });
    const resFrozen = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(resFrozen.status).toBe(200);
    const bodyFrozen = await readJson(resFrozen);
    expectDriverStopsJsonEnvelope(bodyFrozen);
    const frozenStops = bodyFrozen?.data?.stops ?? bodyFrozen?.stops ?? [];
    expect(frozenStops.length).toBe(1);
    expect(frozenStops[0].companyId).toBe(CID);
    expect(frozenStops[0].orderCount).toBe(2);
    expect(frozenStops.reduce((a: number, s: any) => a + s.orderCount, 0)).toBe(2);
    expectDriverStopsCanonicallySorted(liveStops);
    expectDriverStopsCanonicallySorted(frozenStops);
    expectDriverStopsBucketTenancy(liveStops, day, CID, LID);
    expectDriverStopsBucketTenancy(frozenStops, day, CID, LID);
    expect(new Set(liveStops.map((s: any) => s.key))).toEqual(new Set(frozenStops.map((s: any) => s.key)));
    expect(stopsDeliveryShape(frozenStops)).toEqual(stopsDeliveryShape(liveStops));
    expectDriverStopsFieldParityByKey(liveStops, frozenStops);
  });

  test("re-materialisert snapshot: oppdatert order_ids på samme rad reflekteres i stopp (smalt → bredt, ingen stale telles)", async () => {
    const orders = [
      {
        id: O1,
        user_id: U1,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
    ];
    const base = {
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders,
      day_choices: [],
    };

    resetSeed({ ...base, production_operative_snapshots: [] });
    const liveRefDr = await readJson(
      await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" })),
    );
    expectDriverStopsJsonEnvelope(liveRefDr);
    const liveRefStops = liveRefDr?.data?.stops ?? [];
    const liveStopSig = driverStopsOrderSig(liveRefStops);
    expectDriverStopsCanonicallySorted(liveRefStops);
    expectDriverStopsBucketTenancy(liveRefStops, day, CID, LID);
    for (const s of liveRefStops) expectDriverStopFieldContract(s);

    resetSeed({
      ...base,
      production_operative_snapshots: [
        { delivery_date: day, company_id: CID, order_ids: [O1], frozen_at: `${day}T06:00:00Z` },
      ],
    });
    const resNarrow = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(resNarrow.status).toBe(200);
    const narrowBody = await readJson(resNarrow);
    expectDriverStopsJsonEnvelope(narrowBody);
    const narrowStops = narrowBody?.data?.stops ?? [];
    expect(narrowStops.length).toBe(1);
    expect(narrowStops[0].orderCount).toBe(1);
    expect(narrowStops.reduce((a: number, s: any) => a + s.orderCount, 0)).toBe(1);
    expectDriverStopsCanonicallySorted(narrowStops);
    expectDriverStopsBucketTenancy(narrowStops, day, CID, LID);
    expectDriverStopFieldContract(narrowStops[0]);

    resetSeed({
      ...base,
      production_operative_snapshots: [
        { delivery_date: day, company_id: CID, order_ids: [O2, O1], frozen_at: `${day}T07:00:00Z` },
      ],
    });
    const resWide = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(resWide.status).toBe(200);
    const wideBody = await readJson(resWide);
    expectDriverStopsJsonEnvelope(wideBody);
    const wideStops = wideBody?.data?.stops ?? [];
    expect(wideStops.length).toBe(1);
    expect(wideStops[0].orderCount).toBe(2);
    expect(wideStops.reduce((a: number, s: any) => a + s.orderCount, 0)).toBe(2);
    expectDriverStopsCanonicallySorted(wideStops);
    expectDriverStopsBucketTenancy(wideStops, day, CID, LID);
    expect(driverStopsOrderSig(wideStops)).toEqual(liveStopSig);
    expectDriverStopsFieldParityByKey(liveRefStops, wideStops);
  });

  test("korrupt dobbel snapshot-rad samme company_id+delivery_date: limit(1) treffer første rad — stopp orderCount følger den", async () => {
    const orders = [
      {
        id: O1,
        user_id: U1,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
    ];
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders,
      day_choices: [],
      production_operative_snapshots: [
        { delivery_date: day, company_id: CID, order_ids: [O1], frozen_at: `${day}T06:00:00Z` },
        { delivery_date: day, company_id: CID, order_ids: [O1, O2], frozen_at: `${day}T07:00:00Z` },
      ],
    });
    const res = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const dupBody = await readJson(res);
    expectDriverStopsJsonEnvelope(dupBody);
    const stops = dupBody?.data?.stops ?? [];
    expect(stops.length).toBe(1);
    expect(stops[0].orderCount).toBe(1);
    expect(stops.reduce((a: number, s: any) => a + s.orderCount, 0)).toBe(1);
    expectDriverStopsCanonicallySorted(stops);
    expectDriverStopsBucketTenancy(stops, day, CID, LID);
    expectDriverStopFieldContract(stops[0]);
  });

  test("frozen allowlist: ekstra ACTIVE-ordre i DB som ikke er i snapshot telles ikke med (ingen ekstra stopp / ordre)", async () => {
    const orders = [
      {
        id: O1,
        user_id: U1,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O3,
        user_id: U3,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: "kun-live",
      },
    ];
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders,
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: day,
          company_id: CID,
          order_ids: [O1, O2],
          frozen_at: `${day}T06:00:00Z`,
        },
      ],
    });

    const res = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expectDriverStopsJsonEnvelope(body);
    const stops = body?.data?.stops ?? body?.stops ?? [];
    expect(stops.length).toBe(1);
    expect(stops[0].orderCount).toBe(2);
    expectDriverStopsCanonicallySorted(stops);
    expectDriverStopsBucketTenancy(stops, day, CID, LID);
    expectDriverStopFieldContract(stops[0]);
  });

  test("frozen allowlist med ukjent ordre-id: ingen fantomordre (kun snitt mot operative rader)", async () => {
    const phantom = "99999999-9999-4999-8999-999999999999";
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders: [
        {
          id: O1,
          user_id: U1,
          date: day,
          slot: "lunch",
          status: "ACTIVE",
          company_id: CID,
          location_id: LID,
          note: null,
        },
      ],
      day_choices: [],
      production_operative_snapshots: [
        {
          delivery_date: day,
          company_id: CID,
          order_ids: [O1, phantom],
          frozen_at: `${day}T06:00:00Z`,
        },
      ],
    });

    const res = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expectDriverStopsJsonEnvelope(body);
    const stops = body?.data?.stops ?? body?.stops ?? [];
    expect(stops.length).toBe(1);
    expect(stops[0].orderCount).toBe(1);
    expectDriverStopsCanonicallySorted(stops);
    expectDriverStopsBucketTenancy(stops, day, CID, LID);
    expectDriverStopFieldContract(stops[0]);
  });

  test("day_choices CANCELLED filtreres før allowlist: live og frozen med samme order_ids gir samme antall stopp", async () => {
    const orders = [
      {
        id: O1,
        user_id: U1,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        date: day,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: null,
      },
    ];
    const day_choices = [
      {
        user_id: U2,
        company_id: CID,
        location_id: LID,
        date: day,
        choice_key: "basis",
        note: null,
        updated_at: `${day}T09:00:00Z`,
        status: "CANCELLED",
      },
    ];
    const base = {
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders,
      day_choices,
    };

    resetSeed({ ...base, production_operative_snapshots: [] });
    const resLive = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(resLive.status).toBe(200);
    const bodyLiveDc = await readJson(resLive);
    expectDriverStopsJsonEnvelope(bodyLiveDc);
    const rawLiveDc = bodyLiveDc?.data?.stops ?? [];
    const liveStops = stopsDeliveryShape(rawLiveDc);
    expectDriverStopsCanonicallySorted(rawLiveDc);
    expectDriverStopsBucketTenancy(rawLiveDc, day, CID, LID);

    resetSeed({
      ...base,
      production_operative_snapshots: [
        {
          delivery_date: day,
          company_id: CID,
          order_ids: [O1, O2],
          frozen_at: `${day}T06:00:00Z`,
        },
      ],
    });
    const resFrozen = await driverStopsGET(mkReq(`http://localhost/api/driver/stops?date=${day}`, { method: "GET" }));
    expect(resFrozen.status).toBe(200);
    const bodyFrozenDc = await readJson(resFrozen);
    expectDriverStopsJsonEnvelope(bodyFrozenDc);
    const rawFrozenDc = bodyFrozenDc?.data?.stops ?? [];
    const frozenStops = stopsDeliveryShape(rawFrozenDc);
    expectDriverStopsCanonicallySorted(rawFrozenDc);
    expectDriverStopsBucketTenancy(rawFrozenDc, day, CID, LID);

    expect(frozenStops).toEqual(liveStops);
    expect(frozenStops.length).toBe(1);
    expect(frozenStops[0].orderCount).toBe(1);
    expect(new Set(rawLiveDc.map((s: any) => s.key))).toEqual(new Set(rawFrozenDc.map((s: any) => s.key)));
    expectDriverStopsFieldParityByKey(rawLiveDc, rawFrozenDc);
  });
});

describe("driver CSV export – aligned truth & malformed rows", () => {
  test("CSV bruker samme loadOperativeKitchenOrders + vindu-filter som driver-stops (status in ACTIVE/active)", async () => {
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders: [
        {
          id: O1,
          user_id: U1,
          date: "2026-02-02",
          slot: "lunch",
          status: "ACTIVE",
          company_id: CID,
          location_id: LID,
          note: "A",
        },
        {
          id: O2,
          user_id: U1,
          date: "2026-02-02",
          slot: "lunch",
          status: "CANCELLED",
          company_id: CID,
          location_id: LID,
          note: "B",
        },
      ],
      day_choices: [],
    });

    const req = mkReq("http://localhost/driver/csv?date=2026-02-02&window=lunch", { method: "GET" });
    const res = await driverCsvGET(req);
    expect(res.status).toBe(200);

    const statusIn = inCalls.find((c) => c.table === "orders" && c.key === "status");
    expect(statusIn?.values).toEqual(["ACTIVE", "active"]);
  });

  test("malformed rows without company/location are excluded and yield header-only CSV", async () => {
    resetSeed({
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders: [
        {
          id: O1,
          user_id: U1,
          date: "2026-02-02",
          slot: "lunch",
          status: "ACTIVE",
          integrity_status: "ok",
          company_id: null,
          location_id: LID,
          note: "A",
        },
        {
          id: O2,
          user_id: U1,
          date: "2026-02-02",
          slot: "lunch",
          status: "ACTIVE",
          integrity_status: "ok",
          company_id: CID,
          location_id: null,
          note: "B",
        },
      ],
      day_choices: [],
    });

    const req = mkReq("http://localhost/driver/csv?date=2026-02-02&window=lunch", { method: "GET" });
    const res = await driverCsvGET(req);
    expect(res.status).toBe(200);

    const txt = await res.text();
    const lines = txt.trim().split("\n");

    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("Leveringsvindu");
  });

  test("CSV (driver): live og frozen med samme operative ordre i vindu gir identisk fil (ingen notat/ansatt-kolonner)", async () => {
    const d = "2026-02-02";
    const orders = [
      {
        id: O1,
        user_id: U1,
        date: d,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: "skjult-for-sjåfør",
      },
      {
        id: O2,
        user_id: U2,
        date: d,
        slot: "lunch",
        status: "ACTIVE",
        company_id: CID,
        location_id: LID,
        note: "også-skjult",
      },
    ];
    const base = {
      profiles: defaultProfiles,
      companies: defaultCompanies,
      company_locations: defaultLocations,
      orders,
      day_choices: [],
    };

    resetSeed({ ...base, production_operative_snapshots: [] });
    const resLive = await driverCsvGET(mkReq(`http://localhost/driver/csv?date=${d}&window=lunch`, { method: "GET" }));
    expect(resLive.status).toBe(200);
    const csvLive = await resLive.text();

    resetSeed({
      ...base,
      production_operative_snapshots: [
        {
          delivery_date: d,
          company_id: CID,
          order_ids: [O1, O2],
          frozen_at: `${d}T06:00:00Z`,
        },
      ],
    });
    const resFrozen = await driverCsvGET(mkReq(`http://localhost/driver/csv?date=${d}&window=lunch`, { method: "GET" }));
    expect(resFrozen.status).toBe(200);
    const csvFrozen = await resFrozen.text();

    expect(csvFrozen).toBe(csvLive);
    const lines = csvLive.trim().split("\n");
    expect(lines.length).toBe(3);
  });
});
