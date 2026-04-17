import { describe, it, expect } from "vitest";
import {
  loadOperativeKitchenOrders,
  normKitchenSlot,
  filterOperativeByProductionAllowlist,
  type OperativeKitchenOrderRow,
} from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import { materializeProductionOperativeSnapshot } from "@/lib/server/kitchen/materializeProductionOperativeSnapshot";
import { fetchProductionOperativeSnapshotAllowlist } from "@/lib/server/kitchen/fetchProductionOperativeSnapshotAllowlist";

const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const L2 = "cccccccc-cccc-4000-8000-cccccccccccc";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";
const O1 = "00000001-0001-4001-8001-000000000001";
const O2 = "00000002-0002-4002-8002-000000000002";
const O3 = "00000003-0003-4003-8003-000000000003";
/** Annen tenant (UUID v4) — brukes kun i snapshot/scope-regresjon. */
const CID_B = "dddddddd-dddd-4000-8000-dddddddddddd";
const LID_B = "eeeeeeee-eeee-4000-8000-eeeeeeeeeeee";
const U_B = "66666666-6666-4666-8666-666666666666";
const O_B = "0000000b-000b-400b-800b-00000000000b";
const DATE = "2026-02-03";

/** Operativ read-path: hver rad tilhører tenant-bucket (firma + lokasjon); vindu er normert. */
function expectOperativeRowsTenantBucket(rows: OperativeKitchenOrderRow[], companyId: string, locationId: string) {
  for (const r of rows) {
    expect(r.company_id).toBe(companyId);
    expect(r.location_id).toBe(locationId);
    expect(normKitchenSlot(r.slot)).toBeTruthy();
  }
}

/** Mock/DB-rader kan inkludere `date` (select i loadOperativeKitchenOrders). */
const OPERATIVE_KITCHEN_ORDER_ROW_KEYS = [
  "company_id",
  "date",
  "id",
  "location_id",
  "note",
  "slot",
  "status",
  "user_id",
].sort();

function expectOperativeKitchenOrderRowFieldContract(r: OperativeKitchenOrderRow) {
  expect(Object.keys(r).sort()).toEqual(OPERATIVE_KITCHEN_ORDER_ROW_KEYS);
}

/** Snitt mot allowlist: samme rad-id → identisk operativ rad (ingen feltsemantikk-endring, kun filtrering). */
function expectOperativeRowFieldParityLiveVsFrozen(liveRows: OperativeKitchenOrderRow[], frozenRows: OperativeKitchenOrderRow[]) {
  const liveById = new Map(liveRows.map((r) => [r.id, r]));
  for (const fr of frozenRows) {
    const lv = liveById.get(fr.id);
    expect(lv).toBeTruthy();
    expectOperativeKitchenOrderRowFieldContract(fr);
    expectOperativeKitchenOrderRowFieldContract(lv!);
    expect({ ...fr }).toEqual({ ...lv! });
  }
}

/** Minimal thenable query builder: .eq + .in + .limit (+ snapshots: upsert som persisterer i db). */
function makeChainAdmin(seed: { orders: any[]; day_choices?: any[] }) {
  const db = {
    orders: seed.orders,
    day_choices: seed.day_choices ?? [],
    production_operative_snapshots: [] as any[],
  };

  function applyFilters(
    rows: any[],
    st: { filters: { k: string; v: string }[]; ins: Record<string, string[]>; lim: number | null }
  ) {
    let out = [...rows];
    for (const f of st.filters) {
      out = out.filter((r) => String((r as any)[f.k] ?? "") === f.v);
    }
    for (const [k, vals] of Object.entries(st.ins)) {
      const set = new Set(vals);
      out = out.filter((r) => set.has(String((r as any)[k] ?? "")));
    }
    if (st.lim != null) out = out.slice(0, st.lim);
    return out;
  }

  return {
    from(table: string) {
      const st = {
        filters: [] as { k: string; v: string }[],
        ins: {} as Record<string, string[]>,
        lim: null as number | null,
      };

      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          st.filters.push({ k, v: String(v ?? "") });
          return q;
        },
        in: (k: string, vals: unknown[]) => {
          st.ins[k] = (Array.isArray(vals) ? vals : [vals]).map(String);
          return q;
        },
        limit: (n: number) => {
          st.lim = n;
          return q;
        },
        then: (resolve: (v: { data: any[]; error: null }) => void) => {
          const base = [...((db as Record<string, any[]>)[table] ?? [])];
          resolve({ data: applyFilters(base, st), error: null });
        },
      };

      if (table === "production_operative_snapshots") {
        q.upsert = (payload: any) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          for (const r of rows) {
            const dd = String((r as any).delivery_date ?? "");
            const cid = String((r as any).company_id ?? "");
            /** Én canonical rad per (delivery_date, company_id) — fjern ev. duplikater før insert (speiler DB unikhet + overwrite). */
            db.production_operative_snapshots = db.production_operative_snapshots.filter(
              (x) => !(String((x as any).delivery_date ?? "") === dd && String((x as any).company_id ?? "") === cid)
            );
            db.production_operative_snapshots.push({ ...r });
          }
          return Promise.resolve({ error: null, data: null });
        };
      }

      return q;
    },
    __getProductionOperativeSnapshotsForTest: () => db.production_operative_snapshots.map((r) => ({ ...r })),
    __appendSnapshotRowForTest: (row: Record<string, unknown>) => {
      db.production_operative_snapshots.push({ ...row });
    },
  } as any;
}

describe("normKitchenSlot", () => {
  it("normaliserer tomt til lunch og lowercaser", () => {
    expect(normKitchenSlot(null)).toBe("lunch");
    expect(normKitchenSlot("")).toBe("lunch");
    expect(normKitchenSlot("Lunch")).toBe("lunch");
  });
});

describe("filterOperativeByProductionAllowlist", () => {
  it("full allowlist (alle operative id): samme mengde og id-sett som live — eksplisitt live≡frozen-paritet når snapshot dekker hele operative", () => {
    const rows: OperativeKitchenOrderRow[] = [
      {
        id: "a1111111-1111-4111-8111-111111111111",
        user_id: "11111111-1111-4111-8111-111111111111",
        company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        note: null,
        status: "ACTIVE",
        slot: "lunch",
      },
      {
        id: "b2222222-2222-4222-8222-222222222222",
        user_id: "22222222-2222-4222-8222-222222222222",
        company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        note: null,
        status: "ACTIVE",
        slot: "lunch",
      },
    ];
    const allow = new Set(rows.map((r) => r.id));
    const out = filterOperativeByProductionAllowlist(rows, allow);
    expect(out).toHaveLength(rows.length);
    expect([...out.map((r) => r.id)].sort()).toEqual([...rows.map((r) => r.id)].sort());
  });

  it("filtrerer operative rader til låst ordre-id-sett", () => {
    const rows: OperativeKitchenOrderRow[] = [
      {
        id: "a1111111-1111-4111-8111-111111111111",
        user_id: "11111111-1111-4111-8111-111111111111",
        company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        note: null,
        status: "ACTIVE",
        slot: "lunch",
      },
      {
        id: "b2222222-2222-4222-8222-222222222222",
        user_id: "22222222-2222-4222-8222-222222222222",
        company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        location_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        note: null,
        status: "ACTIVE",
        slot: "lunch",
      },
    ];
    const allow = new Set(["a1111111-1111-4111-8111-111111111111"]);
    const out = filterOperativeByProductionAllowlist(rows, allow);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("a1111111-1111-4111-8111-111111111111");
  });
});

/** Sjåfør-API (/api/driver/*) bruker samme loadOperativeKitchenOrders + allowlist som kjøkken — day_choices-semantikk er dermed felles. */
describe("loadOperativeKitchenOrders — day_choices (canonical dcMap)", () => {
  it("fyller dcMap når day_choices matcher company|location|user for operative ordre", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [
        {
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          choice_key: "salatbar",
          note: null,
          updated_at: "2026-02-02T10:00:00Z",
          status: "ACTIVE",
        },
      ],
    });

    const loaded = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    expect(loaded.ok).toBe(true);
    if (loaded.ok !== true) return;
    const k = `${CID}|${LID}|${U1}`;
    expect(loaded.dcMap.get(k)?.choice_key).toBe("salatbar");
    expect(loaded.operative).toHaveLength(1);
  });

  it("dcMap får ikke feil brukers valg: day_choices for annen user_id hentes ikke inn i .in(user_id) for ordrens brukere", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [
        {
          user_id: U2,
          company_id: CID,
          location_id: LID,
          date: DATE,
          choice_key: "basis",
          note: null,
          updated_at: "2026-02-02T10:00:00Z",
          status: "ACTIVE",
        },
      ],
    });

    const loaded = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    expect(loaded.ok).toBe(true);
    if (loaded.ok !== true) return;
    expect(loaded.dcMap.size).toBe(0);
    expect(loaded.dcMap.get(`${CID}|${LID}|${U1}`)).toBeUndefined();
    expect(loaded.operative).toHaveLength(1);
  });

  it("productionFreezeAllowlist endrer operative men ikke dcMap-entry for gjenstående ordre (samme som live)", async () => {
    const dayChoices = [
      {
        user_id: U1,
        company_id: CID,
        location_id: LID,
        date: DATE,
        choice_key: "basis",
        note: null,
        updated_at: "2026-02-02T09:00:00Z",
        status: "ACTIVE",
      },
      {
        user_id: U2,
        company_id: CID,
        location_id: LID,
        date: DATE,
        choice_key: "luxus",
        note: null,
        updated_at: "2026-02-02T09:30:00Z",
        status: "ACTIVE",
      },
    ];
    const orders = [
      {
        id: O1,
        user_id: U1,
        company_id: CID,
        location_id: LID,
        date: DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        company_id: CID,
        location_id: LID,
        date: DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];

    const admin = makeChainAdmin({ orders, day_choices: dayChoices });

    const live = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    const frozen = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: new Set([O1]),
    });

    expect(live.ok).toBe(true);
    expect(frozen.ok).toBe(true);
    if (live.ok !== true || frozen.ok !== true) return;

    const key1 = `${CID}|${LID}|${U1}`;
    expect(frozen.dcMap.get(key1)).toEqual(live.dcMap.get(key1));
    expect(live.operative.map((r) => r.id).sort()).toEqual([O1, O2].sort());
    expect(frozen.operative.map((r) => r.id)).toEqual([O1]);
    for (const r of live.operative) expectOperativeKitchenOrderRowFieldContract(r);
    for (const r of frozen.operative) expectOperativeKitchenOrderRowFieldContract(r);
    expectOperativeRowFieldParityLiveVsFrozen(live.operative, frozen.operative);
  });
});

describe("materializeProductionOperativeSnapshot — live → upsert → lesing (canonical)", () => {
  it("materialiserer order_ids identisk med loadOperativeKitchenOrders.operative for firma+dato (flere lokasjoner)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O2,
          user_id: U2,
          company_id: CID,
          location_id: L2,
          date: DATE,
          status: "active",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });

    const live = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID },
    });
    expect(live.ok).toBe(true);
    if (live.ok !== true) return;

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;

    expect(mat.order_count).toBe(live.operative.length);
    expect(mat.delivery_date).toBe(DATE);
    expect(mat.company_id).toBe(CID);

    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    const ids = [...snap.orderIds].sort();
    expect(ids).toEqual(live.operative.map((r) => r.id).sort());
  });

  it("tar ikke med ACTIVE-ordre når day_choices er CANCELLED (samme filter som live før upsert)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O2,
          user_id: U2,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [
        {
          user_id: U2,
          company_id: CID,
          location_id: LID,
          date: DATE,
          choice_key: "basis",
          note: null,
          updated_at: `${DATE}T09:00:00Z`,
          status: "CANCELLED",
        },
      ],
    });

    const live = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID },
    });
    expect(live.ok).toBe(true);
    if (live.ok !== true) return;
    expect(live.operative.map((r) => r.id)).toEqual([O1]);

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;
    expect(mat.order_count).toBe(1);

    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    expect([...snap.orderIds].sort()).toEqual([O1]);
  });

  it("tar ikke med ordre med status utenfor ACTIVE/active", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O2,
          user_id: U2,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "CANCELLED",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;
    expect(mat.order_count).toBe(1);

    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    expect([...snap.orderIds]).toEqual([O1]);
  });

  it("tar ikke med operative-hull (mangler location_id) i order_ids", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O3,
          user_id: U3,
          company_id: CID,
          location_id: "",
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;
    expect(mat.order_count).toBe(1);
  });

  it("etter materialisering: fetchProductionOperativeSnapshotAllowlist + loadOperativeKitchenOrders med allowlist = samme operative mengde som live (firma-scope)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: "n1",
        },
        {
          id: O2,
          user_id: U2,
          company_id: CID,
          location_id: L2,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [
        {
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          choice_key: "basis",
          note: null,
          updated_at: `${DATE}T08:00:00Z`,
          status: "ACTIVE",
        },
      ],
    });

    const live = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID },
    });
    expect(live.ok).toBe(true);
    if (live.ok !== true) return;

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;

    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;

    const reread = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(reread.ok).toBe(true);
    if (reread.ok !== true) return;

    expect(reread.operative.map((r) => r.id).sort()).toEqual(live.operative.map((r) => r.id).sort());
    const k = `${CID}|${LID}|${U1}`;
    expect(reread.dcMap.get(k)).toEqual(live.dcMap.get(k));
  });

  it("avviser ugyldig company_id uten å kalle load/upsert", async () => {
    const admin = makeChainAdmin({ orders: [], day_choices: [] });
    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: "not-a-uuid" });
    expect(mat.ok).toBe(false);
  });
});

describe("materializeProductionOperativeSnapshot — idempotens og re-materialisering (canonical)", () => {
  it("gjentatt materialisering med uendret grunnlag: samme order_ids-mengde, ingen duplikater, én snapshot-rad, stabil frozen-lesing", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O2,
          user_id: U2,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "active",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });

    const mat1 = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat1.ok).toBe(true);
    if (mat1.ok !== true) return;

    const snap1 = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap1.found).toBe(true);
    if (!snap1.found) return;
    const ids1 = [...snap1.orderIds].sort();

    const frozen1 = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap1.orderIds,
    });
    expect(frozen1.ok).toBe(true);
    if (frozen1.ok !== true) return;

    const mat2 = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat2.ok).toBe(true);
    if (mat2.ok !== true) return;
    expect(mat2.order_count).toBe(mat1.order_count);
    expect(new Date(mat2.frozen_at).getTime()).toBeGreaterThanOrEqual(new Date(mat1.frozen_at).getTime());

    const snap2 = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap2.found).toBe(true);
    if (!snap2.found) return;
    expect([...snap2.orderIds].sort()).toEqual(ids1);

    const frozen2 = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap2.orderIds,
    });
    expect(frozen2.ok).toBe(true);
    if (frozen2.ok !== true) return;
    expect(frozen2.operative.map((r) => r.id).sort()).toEqual(frozen1.operative.map((r) => r.id).sort());

    const rows = (admin as any).__getProductionOperativeSnapshotsForTest() as any[];
    const forKey = rows.filter((r) => r.delivery_date === DATE && r.company_id === CID);
    expect(forKey).toHaveLength(1);
    const persisted = forKey[0]?.order_ids as unknown[];
    expect(Array.isArray(persisted)).toBe(true);
    expect(new Set(persisted.map(String)).size).toBe(persisted.length);
    expect([...(persisted as string[])].sort()).toEqual(ids1);
  });

  it("re-materialisering etter ny operativ ordre: snapshot utvides, ingen hengende stale id", async () => {
    const orders: any[] = [
      {
        id: O1,
        user_id: U1,
        company_id: CID,
        location_id: LID,
        date: DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];
    const admin = makeChainAdmin({ orders, day_choices: [] });

    const m1 = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(m1.ok).toBe(true);
    if (m1.ok !== true) return;
    const s1 = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(s1.found).toBe(true);
    if (!s1.found) return;
    expect([...s1.orderIds].sort()).toEqual([O1]);

    orders.push({
      id: O2,
      user_id: U2,
      company_id: CID,
      location_id: LID,
      date: DATE,
      status: "ACTIVE",
      slot: "lunch",
      note: null,
    });

    const m2 = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(m2.ok).toBe(true);
    if (m2.ok !== true) return;
    expect(m2.order_count).toBe(2);

    const s2 = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(s2.found).toBe(true);
    if (!s2.found) return;
    expect([...s2.orderIds].sort()).toEqual([O1, O2].sort());

    const live = await loadOperativeKitchenOrders({ admin, dateISO: DATE, tenant: { companyId: CID, locationId: LID } });
    const frozen = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: s2.orderIds,
    });
    expect(live.ok).toBe(true);
    expect(frozen.ok).toBe(true);
    if (live.ok !== true || frozen.ok !== true) return;
    expect(frozen.operative.map((r) => r.id).sort()).toEqual(live.operative.map((r) => r.id).sort());

    const rows = (admin as any).__getProductionOperativeSnapshotsForTest() as any[];
    expect(rows.filter((r) => r.delivery_date === DATE && r.company_id === CID)).toHaveLength(1);
  });

  it("re-materialisering etter at ordre faller ut av operativt grunnlag: snapshot strammes, ingen stale id", async () => {
    const orders: any[] = [
      {
        id: O1,
        user_id: U1,
        company_id: CID,
        location_id: LID,
        date: DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
      {
        id: O2,
        user_id: U2,
        company_id: CID,
        location_id: LID,
        date: DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
      },
    ];
    const day_choices: any[] = [];
    const admin = makeChainAdmin({ orders, day_choices });

    const m1 = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(m1.ok).toBe(true);
    if (m1.ok !== true) return;
    const s1 = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    if (!s1.found) return;
    expect([...s1.orderIds].sort()).toEqual([O1, O2].sort());

    day_choices.push({
      user_id: U2,
      company_id: CID,
      location_id: LID,
      date: DATE,
      choice_key: "basis",
      note: null,
      updated_at: `${DATE}T09:00:00Z`,
      status: "CANCELLED",
    });

    const m2 = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(m2.ok).toBe(true);
    if (m2.ok !== true) return;
    expect(m2.order_count).toBe(1);

    const s2 = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(s2.found).toBe(true);
    if (!s2.found) return;
    expect([...s2.orderIds].sort()).toEqual([O1]);
    expect(s2.orderIds.has(O2)).toBe(false);

    const frozen = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: s2.orderIds,
    });
    expect(frozen.ok).toBe(true);
    if (frozen.ok !== true) return;
    expect(frozen.operative.map((r) => r.id)).toEqual([O1]);
  });
});

describe("production_operative_snapshots — radidentitet, overwrite og limit(1)-lesing (canonical mock)", () => {
  it("første materialisering: nøyaktig én rad for company_id + delivery_date; operative order_ids matcher slot lunch i seed", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });

    const live = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    expect(live.ok).toBe(true);
    if (live.ok !== true) return;
    expect(live.operative.every((r) => normKitchenSlot(r.slot) === "lunch")).toBe(true);

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;

    const rows = (admin as any).__getProductionOperativeSnapshotsForTest() as any[];
    const forKey = rows.filter((r) => r.delivery_date === DATE && r.company_id === CID);
    expect(forKey).toHaveLength(1);
    expect(forKey[0]?.order_ids?.map(String).sort()).toEqual([O1]);
  });

  it("korrupt dobbeltrad samme company_id+delivery_date: fetch følger limit(1) (første rad); materialize overskriver til én konsolidert rad uten stale id", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O2,
          user_id: U2,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });

    (admin as any).__appendSnapshotRowForTest({
      delivery_date: DATE,
      company_id: CID,
      order_ids: [O1],
      frozen_at: `${DATE}T06:00:00.000Z`,
    });
    (admin as any).__appendSnapshotRowForTest({
      delivery_date: DATE,
      company_id: CID,
      order_ids: [O2],
      frozen_at: `${DATE}T07:00:00.000Z`,
    });

    const dupRows = (admin as any).__getProductionOperativeSnapshotsForTest() as any[];
    expect(dupRows.filter((r) => r.delivery_date === DATE && r.company_id === CID)).toHaveLength(2);

    const snapBefore = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snapBefore.found).toBe(true);
    if (!snapBefore.found) return;
    expect([...snapBefore.orderIds].sort()).toEqual([O1]);

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;

    const after = (admin as any).__getProductionOperativeSnapshotsForTest() as any[];
    expect(after.filter((r) => r.delivery_date === DATE && r.company_id === CID)).toHaveLength(1);
    expect([...(after.find((r) => r.delivery_date === DATE && r.company_id === CID)?.order_ids ?? [])].sort()).toEqual(
      [O1, O2].sort()
    );

    const snapAfter = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snapAfter.found).toBe(true);
    if (!snapAfter.found) return;
    expect([...snapAfter.orderIds].sort()).toEqual([O1, O2].sort());

    const frozen = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snapAfter.orderIds,
    });
    expect(frozen.ok).toBe(true);
    if (frozen.ok !== true) return;
    expect(frozen.operative.map((r) => r.id).sort()).toEqual([O1, O2].sort());
  });
});

describe("tenant / scope — snapshot materialisering og lesing (cross-company, lokasjon, paritet)", () => {
  it("materialiserer ikke ordre fra annet firma (samme dato og slot)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O_B,
          user_id: U_B,
          company_id: CID_B,
          location_id: LID_B,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;
    expect(mat.order_count).toBe(1);

    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    expect([...snap.orderIds].sort()).toEqual([O1]);
    expect(snap.orderIds.has(O_B)).toBe(false);

    const snapB = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID_B });
    expect(snapB.found).toBe(false);
  });

  it("fetchProductionOperativeSnapshotAllowlist er per company_id når flere firma har snapshot samme dato", async () => {
    const admin = makeChainAdmin({ orders: [], day_choices: [] });
    await (admin as any).from("production_operative_snapshots").upsert([
      { delivery_date: DATE, company_id: CID, order_ids: [O1], frozen_at: `${DATE}T06:00:00.000Z` },
      { delivery_date: DATE, company_id: CID_B, order_ids: [O_B], frozen_at: `${DATE}T06:01:00.000Z` },
    ]);
    const a = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    const b = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID_B });
    expect(a.found && b.found).toBe(true);
    if (!a.found || !b.found) return;
    expect([...a.orderIds].sort()).toEqual([O1]);
    expect([...b.orderIds].sort()).toEqual([O_B]);
  });

  it("lokasjonsscope: frozen med company-wide snapshot matcher live-path for én lokasjon (ingen ordre fra annen lokasjon)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O2,
          user_id: U2,
          company_id: CID,
          location_id: L2,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;

    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    expect([...snap.orderIds].sort()).toEqual([O1, O2].sort());

    const liveLoc = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    const frozenLoc = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(liveLoc.ok).toBe(true);
    expect(frozenLoc.ok).toBe(true);
    if (liveLoc.ok !== true || frozenLoc.ok !== true) return;

    expect(liveLoc.operative.map((r) => r.id).sort()).toEqual([O1]);
    expect(frozenLoc.operative.map((r) => r.id).sort()).toEqual(liveLoc.operative.map((r) => r.id).sort());
    expect(frozenLoc.operative.some((r) => r.location_id === L2)).toBe(false);
    expectOperativeRowsTenantBucket(liveLoc.operative, CID, LID);
    expectOperativeRowsTenantBucket(frozenLoc.operative, CID, LID);
    expectOperativeRowFieldParityLiveVsFrozen(liveLoc.operative, frozenLoc.operative);
  });

  it("allowlist med ordre-id fra annet firma kryper ikke inn i operative (snitt med tenant-spørring)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O_B,
          user_id: U_B,
          company_id: CID_B,
          location_id: LID_B,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });

    const live = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    expect(live.ok).toBe(true);
    if (live.ok !== true) return;
    expect(live.operative.map((r) => r.id)).toEqual([O1]);

    const poisoned = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: new Set([O1, O_B]),
    });
    expect(poisoned.ok).toBe(true);
    if (poisoned.ok !== true) return;
    expect(poisoned.operative.map((r) => r.id)).toEqual([O1]);
    expect(poisoned.operative.some((r) => r.company_id === CID_B)).toBe(false);
    expectOperativeRowsTenantBucket(poisoned.operative, CID, LID);
    expectOperativeRowFieldParityLiveVsFrozen(live.operative, poisoned.operative);
  });
});

describe("fetchProductionOperativeSnapshotAllowlist — read-contract (lookup, no-snapshot, datofilter)", () => {
  it("tom dateISO → found false (ingen falsk allowlist)", async () => {
    const admin = makeChainAdmin({ orders: [], day_choices: [] });
    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: "", companyId: CID });
    expect(snap).toEqual({ found: false });
  });

  it("tom companyId → found false", async () => {
    const admin = makeChainAdmin({ orders: [], day_choices: [] });
    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: "  " });
    expect(snap).toEqual({ found: false });
  });

  it("feil delivery_date: snapshot finnes kun for annen dato → found false (ingen kryss-dato-lesing)", async () => {
    const admin = makeChainAdmin({ orders: [], day_choices: [] });
    await (admin as any).from("production_operative_snapshots").upsert([
      { delivery_date: DATE, company_id: CID, order_ids: [O1], frozen_at: `${DATE}T06:00:00.000Z` },
    ]);
    const other = "2026-02-10";
    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: other, companyId: CID });
    expect(snap).toEqual({ found: false });
  });

  it("ingen snapshot-rad: found false; ingen orderIds-felt; live operative uendret uten freeze", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });
    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(false);
    expect("orderIds" in snap).toBe(false);
    const live = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    expect(live.ok).toBe(true);
    if (live.ok !== true) return;
    expect(live.operative.map((r) => r.id)).toEqual([O1]);
    expectOperativeRowsTenantBucket(live.operative, CID, LID);
    expectOperativeKitchenOrderRowFieldContract(live.operative[0]);
  });

  it("fetch → frozen: operative id-sett er eksakt snitt av allowlist ∩ tenant-query (ingen ekstra id)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O2,
          user_id: U2,
          company_id: CID,
          location_id: L2,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });
    await (admin as any).from("production_operative_snapshots").upsert([
      { delivery_date: DATE, company_id: CID, order_ids: [O1, O2], frozen_at: `${DATE}T06:00:00.000Z` },
    ]);
    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    expect(snap.frozenAt).toBeTruthy();
    const frozen = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(frozen.ok).toBe(true);
    if (frozen.ok !== true) return;
    const frozIds = frozen.operative.map((r) => r.id).sort();
    expect(frozIds).toEqual([O1]);
    for (const id of frozIds) {
      expect(snap.orderIds.has(id)).toBe(true);
    }
    expect([...snap.orderIds].sort()).toEqual([O1, O2].sort());
    const liveFetchFrozen = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    expect(liveFetchFrozen.ok).toBe(true);
    if (liveFetchFrozen.ok !== true) return;
    expectOperativeRowFieldParityLiveVsFrozen(
      liveFetchFrozen.operative.filter((r) => frozen.operative.some((f) => f.id === r.id)),
      frozen.operative,
    );
  });
});

describe("fetchProductionOperativeSnapshotAllowlist — failure / corruption (canonical normalisering)", () => {
  it("snapshot-rad med order_ids: [] → found true, tom allowlist; frozen operative = [], live uendret (ingen falsk rad)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });
    await (admin as any).from("production_operative_snapshots").upsert([
      { delivery_date: DATE, company_id: CID, order_ids: [], frozen_at: `${DATE}T06:00:00.000Z` },
    ]);
    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    expect(snap.orderIds.size).toBe(0);
    const live = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    const frozen = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(live.ok).toBe(true);
    expect(frozen.ok).toBe(true);
    if (live.ok !== true || frozen.ok !== true) return;
    expect(live.operative.map((r) => r.id)).toEqual([O1]);
    expect(frozen.operative).toHaveLength(0);
    expectOperativeRowsTenantBucket(live.operative, CID, LID);
    expectOperativeRowsTenantBucket(frozen.operative, CID, LID);
  });

  it("order_ids: null → ikke-array; fetch normaliserer til tom Set (ingen stille feil, frozen tom)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });
    (admin as any).__appendSnapshotRowForTest({
      delivery_date: DATE,
      company_id: CID,
      order_ids: null,
      frozen_at: `${DATE}T06:00:00.000Z`,
    });
    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    expect(snap.orderIds.size).toBe(0);
    const frozen = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(frozen.ok).toBe(true);
    if (frozen.ok !== true) return;
    expect(frozen.operative).toHaveLength(0);
  });

  it("order_ids: ikke-array (string) → normaliseres til tom Set som null; frozen tom", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });
    (admin as any).__appendSnapshotRowForTest({
      delivery_date: DATE,
      company_id: CID,
      order_ids: "korrupt-ikke-array",
      frozen_at: `${DATE}T06:00:00.000Z`,
    });
    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    expect(snap.orderIds.size).toBe(0);
    const frozen = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(frozen.ok).toBe(true);
    if (frozen.ok !== true) return;
    expect(frozen.operative).toHaveLength(0);
  });

  it("snapshot order_ids kun annet firmas ordre-id: snitt med tenant gir tom frozen (ingen cross-company bleed)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
        {
          id: O_B,
          user_id: U_B,
          company_id: CID_B,
          location_id: LID_B,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
        },
      ],
      day_choices: [],
    });
    await (admin as any).from("production_operative_snapshots").upsert([
      { delivery_date: DATE, company_id: CID, order_ids: [O_B], frozen_at: `${DATE}T06:00:00.000Z` },
    ]);
    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    expect(snap.orderIds.has(O_B)).toBe(true);
    const frozen = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(frozen.ok).toBe(true);
    if (frozen.ok !== true) return;
    expect(frozen.operative).toHaveLength(0);
    expect(frozen.operative.some((r) => r.id === O_B)).toBe(false);
  });
});

/**
 * Canonical kitchen/driver/snapshot bruker loadOperativeKitchenOrders (ingen created_at-cutoff).
 * fetchKitchenDayData har separat created_at-filter — disse testene låser at snapshot ikke utvider
 * frozen-lesing når operative datasett vokser etter materialisering (frys-paritet / analog cutoff).
 */
describe("cutoff / frys-paritet — snapshot vs voksende operative grunnlag (canonical)", () => {
  it("når nye operative ordre legges til etter materialisering: live øker, frozen allowlist-lesing endres ikke", async () => {
    const orders: any[] = [
      {
        id: O1,
        user_id: U1,
        company_id: CID,
        location_id: LID,
        date: DATE,
        status: "ACTIVE",
        slot: "lunch",
        note: null,
        created_at: `${DATE}T05:00:00.000Z`,
      },
    ];
    const admin = makeChainAdmin({ orders, day_choices: [] });

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;
    expect(mat.order_count).toBe(1);

    orders.push({
      id: O2,
      user_id: U2,
      company_id: CID,
      location_id: LID,
      date: DATE,
      status: "ACTIVE",
      slot: "lunch",
      note: null,
      created_at: `${DATE}T12:00:00.000Z`,
    });

    const liveAfter = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    expect(liveAfter.ok).toBe(true);
    if (liveAfter.ok !== true) return;
    expect(liveAfter.operative.map((r) => r.id).sort()).toEqual([O1, O2].sort());

    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;

    const frozenAfter = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(frozenAfter.ok).toBe(true);
    if (frozenAfter.ok !== true) return;
    expect(frozenAfter.operative.map((r) => r.id)).toEqual([O1]);
  });

  it("materialisering inkluderer alle canonical-operative ACTIVE-ordre uavhengig av created_at (samme som live-path uten snapshot)", async () => {
    const admin = makeChainAdmin({
      orders: [
        {
          id: O1,
          user_id: U1,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
          created_at: "2026-02-03T05:00:00.000Z",
        },
        {
          id: O2,
          user_id: U2,
          company_id: CID,
          location_id: LID,
          date: DATE,
          status: "ACTIVE",
          slot: "lunch",
          note: null,
          created_at: "2026-02-03T10:00:00.000Z",
        },
      ],
      day_choices: [],
    });

    const live = await loadOperativeKitchenOrders({
      admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
    });
    expect(live.ok).toBe(true);
    if (live.ok !== true) return;
    expect(live.operative.map((r) => r.id).sort()).toEqual([O1, O2].sort());

    const mat = await materializeProductionOperativeSnapshot(admin as any, { dateISO: DATE, companyId: CID });
    expect(mat.ok).toBe(true);
    if (mat.ok !== true) return;
    expect(mat.order_count).toBe(2);

    const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    if (!snap.found) return;
    expect([...snap.orderIds].sort()).toEqual([O1, O2].sort());

    const tCut = new Date(`${DATE}T07:00:00.000Z`).getTime();
    expect(new Date("2026-02-03T05:00:00.000Z").getTime()).toBeLessThanOrEqual(tCut);
    expect(new Date("2026-02-03T10:00:00.000Z").getTime()).toBeGreaterThan(tCut);
  });
});
