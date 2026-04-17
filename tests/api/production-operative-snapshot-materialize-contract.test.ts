// @ts-nocheck
/**
 * Write-contract: internal + superadmin POST → materializeProductionOperativeSnapshot
 * persisterer én canonical rad (company_id + delivery_date + order_ids) uten cross-tenant bleed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { AuthedCtx } from "@/lib/http/routeGuard";
import { fetchProductionOperativeSnapshotAllowlist } from "@/lib/server/kitchen/fetchProductionOperativeSnapshotAllowlist";
import { loadOperativeKitchenOrders } from "@/lib/server/kitchen/loadOperativeKitchenOrders";

const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CID_B = "dddddddd-dddd-4000-8000-dddddddddddd";
const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LID_B = "eeeeeeee-eeee-4000-8000-eeeeeeeeeeee";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U_B = "66666666-6666-4666-8666-666666666666";
const O1 = "00000001-0001-4001-8001-000000000001";
const O2 = "00000002-0002-4002-8002-000000000002";
const O_B = "0000000b-000b-400b-800b-00000000000b";
const DATE = "2026-02-03";

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const adminHolder = vi.hoisted(() => ({ admin: null as any }));
const upsertPayloads = vi.hoisted(() => [] as any[]);

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

function createChainAdmin(seed: { orders: any[]; day_choices?: any[] }) {
  const db = {
    orders: seed.orders,
    day_choices: seed.day_choices ?? [],
    production_operative_snapshots: [] as any[],
  };

  return {
    _db: db,
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
            upsertPayloads.push({ ...r });
            const dd = String((r as any).delivery_date ?? "");
            const cid = String((r as any).company_id ?? "");
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
  };
}

vi.mock("@/lib/http/routeGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/routeGuard")>();
  return {
    ...actual,
    scopeOr401: (...args: unknown[]) => scopeOr401Mock(...args),
  };
});

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => true,
    supabaseAdmin: () => adminHolder.admin,
  };
});

function authedSuperadmin(): { ok: true; ctx: AuthedCtx } {
  return {
    ok: true,
    ctx: {
      rid: "rid_snap_contract",
      route: "/api/superadmin/production-operative-snapshot/materialize",
      method: "POST",
      scope: {
        userId: "99999999-9999-4999-8999-999999999999",
        role: "superadmin",
        companyId: null,
        locationId: null,
        email: "sa@test.no",
        sub: "sub-sa",
      },
    },
  };
}

async function readJson(res: Response) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { raw: t };
  }
}

/** Transport headers from `buildJsonHeaders` / `noStoreHeaders` (jsonOk/jsonErr). */
function assertCanonicalJsonTransportHeaders(res: Response, bodyRid: string) {
  expect(bodyRid.length).toBeGreaterThan(0);
  const ct = String(res.headers.get("content-type") ?? "").toLowerCase();
  expect(ct).toContain("application/json");
  expect(ct).toContain("charset=utf-8");
  expect(res.headers.get("x-rid")).toBe(bodyRid);
  expect(String(res.headers.get("cache-control") ?? "").toLowerCase()).toContain("no-store");
  expect(res.headers.get("pragma")?.toLowerCase()).toBe("no-cache");
  expect(res.headers.get("expires")).toBe("0");
  expect(String(res.headers.get("surrogate-control") ?? "").toLowerCase()).toContain("no-store");
  expect(res.headers.get("x-content-type-options")?.toLowerCase()).toBe("nosniff");
}

/** Canonical success envelope: HTTP + JSON + x-rid ↔ body.rid + materialize data keys. */
function assertApiOkMaterializeEnvelope(res: Response, j: Record<string, unknown>) {
  expect(res.status).toBe(200);
  expect(typeof j?.rid).toBe("string");
  assertCanonicalJsonTransportHeaders(res, String(j.rid));
  expect(j).toEqual(
    expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        delivery_date: expect.any(String),
        company_id: expect.any(String),
        order_count: expect.any(Number),
        frozen_at: expect.any(String),
      }),
    }),
  );
}

/** Canonical error envelope from `jsonErr` (status + shape; optional `detail` in RC/test). */
function assertApiErrEnvelope(
  res: Response,
  j: Record<string, unknown>,
  expectedStatus: number,
  expectedError: string
) {
  expect(res.status).toBe(expectedStatus);
  expect(typeof j?.rid).toBe("string");
  assertCanonicalJsonTransportHeaders(res, String(j.rid));
  expect(j).toEqual(
    expect.objectContaining({
      ok: false,
      status: expectedStatus,
      message: expect.any(String),
      error: expectedError,
    }),
  );
}

/** Driftssporing: success `data` speiler faktisk materialisert company+dato; `frozen_at` parsebar; `rid` ventil. */
function assertMaterializeSuccessDriftSignature(
  j: Record<string, unknown>,
  expected: { companyId: string; dateISO: string; internalSnapRid?: boolean; expectedRid?: string }
) {
  const d = j?.data as Record<string, unknown> | undefined;
  expect(d?.company_id).toBe(expected.companyId);
  expect(d?.delivery_date).toBe(expected.dateISO);
  expect(typeof d?.order_count).toBe("number");
  expect(Number.isFinite(Number(d?.order_count))).toBe(true);
  const frozen = String(d?.frozen_at ?? "");
  expect(frozen.length).toBeGreaterThan(10);
  expect(Number.isNaN(Date.parse(frozen))).toBe(false);
  expect(String(j?.rid ?? "").length).toBeGreaterThan(4);
  if (expected.internalSnapRid) {
    expect(String(j.rid).startsWith("snap_")).toBe(true);
  }
  if (expected.expectedRid != null) {
    expect(j.rid).toBe(expected.expectedRid);
  }
}

/** Driftssporing: feilrespons har ikke-tom `message` + `rid` (for korrelasjon mot header). */
function assertFailureDriftSignature(j: Record<string, unknown>) {
  expect(String(j?.message ?? "").trim().length).toBeGreaterThan(0);
  expect(String(j?.rid ?? "").length).toBeGreaterThan(4);
}

const CRON = "snap-materialize-contract-secret";
let prevCron: string | undefined;

describe("production-operative-snapshot materialize — write-contract (internal + superadmin)", () => {
  beforeEach(() => {
    upsertPayloads.length = 0;
    prevCron = process.env.CRON_SECRET;
    process.env.CRON_SECRET = CRON;
  });

  afterEach(() => {
    if (prevCron !== undefined) process.env.CRON_SECRET = prevCron;
    else delete process.env.CRON_SECRET;
    adminHolder.admin = null;
    vi.clearAllMocks();
  });

  it("internal POST: persisterer company_id + delivery_date + order_ids for scoped operative grunnlag; frozen matcher fetch", async () => {
    adminHolder.admin = createChainAdmin({
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

    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}`, "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiOkMaterializeEnvelope(res, body);
    expect(body?.data?.company_id).toBe(CID);
    expect(body?.data?.delivery_date).toBe(DATE);
    expect(body?.data?.order_count).toBe(1);

    const last = upsertPayloads[upsertPayloads.length - 1];
    expect(last?.company_id).toBe(CID);
    expect(last?.delivery_date).toBe(DATE);
    expect([...(last?.order_ids ?? [])].sort()).toEqual([O1]);

    const snap = await fetchProductionOperativeSnapshotAllowlist(adminHolder.admin, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    const frozen = await loadOperativeKitchenOrders({
      admin: adminHolder.admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(frozen.ok).toBe(true);
    expect(frozen.operative.map((r) => r.id).sort()).toEqual([O1]);
  });

  it("internal POST overwrite: andre kall samme nøkkel — én rad, oppdatert order_ids, siste upsert matcher fetch", async () => {
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
    adminHolder.admin = createChainAdmin({ orders, day_choices: [] });

    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const mk = () =>
      new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
        method: "POST",
        headers: { authorization: `Bearer ${CRON}`, "content-type": "application/json" },
        body: JSON.stringify({ date: DATE, companyId: CID }),
      });

    const res1 = await POST(mk());
    const body1 = (await readJson(res1)) as Record<string, unknown>;
    assertApiOkMaterializeEnvelope(res1, body1);

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
    const res2 = await POST(mk());
    const body2 = (await readJson(res2)) as Record<string, unknown>;
    assertApiOkMaterializeEnvelope(res2, body2);

    const rows = adminHolder.admin._db.production_operative_snapshots.filter(
      (r: any) => r.delivery_date === DATE && r.company_id === CID
    );
    expect(rows).toHaveLength(1);
    expect([...(rows[0].order_ids ?? [])].sort()).toEqual([O1, O2].sort());

    const last = upsertPayloads[upsertPayloads.length - 1];
    expect([...(last?.order_ids ?? [])].sort()).toEqual([O1, O2].sort());

    const snap = await fetchProductionOperativeSnapshotAllowlist(adminHolder.admin, { dateISO: DATE, companyId: CID });
    expect(snap.found).toBe(true);
    const frozen = await loadOperativeKitchenOrders({
      admin: adminHolder.admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(frozen.ok).toBe(true);
    expect(frozen.operative.map((r) => r.id).sort()).toEqual([O1, O2].sort());
  });

  it("internal POST: companyId i body materialiserer ikke annet firmas ordre; persistert company_id følger body", async () => {
    adminHolder.admin = createChainAdmin({
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

    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}`, "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiOkMaterializeEnvelope(res, body);
    const last = upsertPayloads[upsertPayloads.length - 1];
    expect(last?.company_id).toBe(CID);
    expect(last?.order_ids?.map(String).sort()).toEqual([O1]);
    expect(last?.order_ids?.includes(O_B)).toBe(false);
  });

  it("internal POST: ugyldig companyId → 400 MATERIALIZE_FAILED (ingen cross-tenant skriv)", async () => {
    adminHolder.admin = createChainAdmin({
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

    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}`, "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: "not-a-uuid" }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, body, 400, "MATERIALIZE_FAILED");
    expect(String(body?.message ?? "")).toMatch(/company/i);
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("internal POST: mangler date → 400 BAD_REQUEST", async () => {
    adminHolder.admin = createChainAdmin({ orders: [], day_choices: [] });
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}`, "content-type": "application/json" },
      body: JSON.stringify({ companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, body, 400, "BAD_REQUEST");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin POST: samme write-contract og frozen-paritet som internal", async () => {
    scopeOr401Mock.mockResolvedValue(authedSuperadmin());
    adminHolder.admin = createChainAdmin({
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

    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiOkMaterializeEnvelope(res, body);
    expect(body?.data?.company_id).toBe(CID);
    expect(body?.data?.delivery_date).toBe(DATE);
    expect(body?.data?.order_count).toBe(1);
    const last = upsertPayloads[upsertPayloads.length - 1];
    expect(last?.company_id).toBe(CID);
    expect(last?.delivery_date).toBe(DATE);

    const snap = await fetchProductionOperativeSnapshotAllowlist(adminHolder.admin, { dateISO: DATE, companyId: CID });
    const frozen = await loadOperativeKitchenOrders({
      admin: adminHolder.admin,
      dateISO: DATE,
      tenant: { companyId: CID, locationId: LID },
      productionFreezeAllowlist: snap.orderIds,
    });
    expect(frozen.ok).toBe(true);
    expect(frozen.operative.map((r) => r.id)).toEqual([O1]);
  });
});

describe("production-operative-snapshot materialize — method / verb-contract (App Router)", () => {
  const otherVerbs = ["GET", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;

  beforeEach(() => {
    upsertPayloads.length = 0;
    process.env.CRON_SECRET = CRON;
    adminHolder.admin = createChainAdmin({
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
  });

  afterEach(() => {
    adminHolder.admin = null;
    vi.clearAllMocks();
  });

  it("internal: kun POST-handler eksportert (andre verb har ingen route-handler → runtime 405, aldri materialize/upsert)", async () => {
    const mod = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    expect(typeof mod.POST).toBe("function");
    for (const v of otherVerbs) {
      expect((mod as Record<string, unknown>)[v]).toBeUndefined();
    }
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: kun POST-handler eksportert (andre verb har ingen route-handler → runtime 405, aldri materialize/upsert)", async () => {
    const mod = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    expect(typeof mod.POST).toBe("function");
    for (const v of otherVerbs) {
      expect((mod as Record<string, unknown>)[v]).toBeUndefined();
    }
    assertNoSnapshotWrite(adminHolder.admin);
  });
});

function assertNoSnapshotWrite(admin: any) {
  expect(upsertPayloads.length).toBe(0);
  expect(admin?._db?.production_operative_snapshots?.length ?? 0).toBe(0);
}

describe("production-operative-snapshot materialize — observability / audit-contract (RID + sporbar respons)", () => {
  let prevObsCron: string | undefined;

  beforeEach(() => {
    upsertPayloads.length = 0;
    prevObsCron = process.env.CRON_SECRET;
    process.env.CRON_SECRET = CRON;
    adminHolder.admin = createChainAdmin({
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
  });

  afterEach(() => {
    if (prevObsCron !== undefined) process.env.CRON_SECRET = prevObsCron;
    else delete process.env.CRON_SECRET;
    adminHolder.admin = null;
    vi.clearAllMocks();
  });

  it("internal success: snap_*-rid + data speiler forespørsel; siste upsert matcher body.data (driftssporing)", async () => {
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}`, "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiOkMaterializeEnvelope(res, j);
    assertMaterializeSuccessDriftSignature(j, { companyId: CID, dateISO: DATE, internalSnapRid: true });
    const last = upsertPayloads[upsertPayloads.length - 1];
    expect(last?.company_id).toBe((j.data as Record<string, unknown>)?.company_id);
    expect(last?.delivery_date).toBe((j.data as Record<string, unknown>)?.delivery_date);
  });

  it("internal 400 BAD_REQUEST: sporbar avvisning (rid, message, error, ev. detail); ingen write", async () => {
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}`, "content-type": "application/json" },
      body: JSON.stringify({ date: DATE }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "BAD_REQUEST");
    assertFailureDriftSignature(j);
    if (j.detail != null && typeof j.detail === "object") {
      expect(j.detail).toEqual(expect.objectContaining({ detail: expect.objectContaining({ date: DATE }) }));
    }
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin success: body.rid === ctx.rid (scopeOr401); data speiler forespørsel; upsert matcher data", async () => {
    scopeOr401Mock.mockResolvedValue(authedSuperadmin());
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiOkMaterializeEnvelope(res, j);
    assertMaterializeSuccessDriftSignature(j, {
      companyId: CID,
      dateISO: DATE,
      expectedRid: "rid_snap_contract",
    });
    const last = upsertPayloads[upsertPayloads.length - 1];
    expect(last?.company_id).toBe(CID);
    expect(last?.delivery_date).toBe(DATE);
  });

  it("superadmin 401 UNAUTHORIZED: sporbar feil-konvolutt; ingen write", async () => {
    scopeOr401Mock.mockResolvedValue(scopeDenied401());
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 401, "UNAUTHORIZED");
    assertFailureDriftSignature(j);
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("internal 403 forbidden (cron): sporbar avvisning; ingen write", async () => {
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 403, "forbidden");
    assertFailureDriftSignature(j);
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin 403 FORBIDDEN (feil rolle): sporbar feil-konvolutt; ingen write", async () => {
    scopeOr401Mock.mockResolvedValue(authedRole("company_admin", CID));
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 403, "FORBIDDEN");
    assertFailureDriftSignature(j);
    assertNoSnapshotWrite(adminHolder.admin);
  });
});

describe("production-operative-snapshot materialize — payload / input-contract (gyldig auth, ugyldig body)", () => {
  let prevCronPayload: string | undefined;

  beforeEach(() => {
    upsertPayloads.length = 0;
    prevCronPayload = process.env.CRON_SECRET;
    process.env.CRON_SECRET = CRON;
    adminHolder.admin = createChainAdmin({
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
  });

  afterEach(() => {
    if (prevCronPayload !== undefined) process.env.CRON_SECRET = prevCronPayload;
    else delete process.env.CRON_SECRET;
    adminHolder.admin = null;
    vi.clearAllMocks();
  });

  function internalAuthorizedPost(body: unknown) {
    return new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}`, "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("internal: mangler companyId → 400 BAD_REQUEST; ingen write", async () => {
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const res = await POST(internalAuthorizedPost({ date: DATE }));
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "BAD_REQUEST");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("internal: tom body → 400 BAD_REQUEST; ingen write", async () => {
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const res = await POST(internalAuthorizedPost({}));
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "BAD_REQUEST");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("internal: feil feltnavn (delivery_date/company_id) → 400 BAD_REQUEST; ingen write", async () => {
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const res = await POST(
      internalAuthorizedPost({ delivery_date: DATE, company_id: CID })
    );
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "BAD_REQUEST");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("internal: ugyldig date-format → 400 MATERIALIZE_FAILED; ingen write", async () => {
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const res = await POST(internalAuthorizedPost({ date: "03.02.2026", companyId: CID }));
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "MATERIALIZE_FAILED");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("internal: tom JSON-streng som body → 400; ingen write", async () => {
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const res = await POST(internalAuthorizedPost(""));
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "BAD_REQUEST");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: mangler companyId → 400 BAD_REQUEST; ingen write", async () => {
    scopeOr401Mock.mockResolvedValue(authedSuperadmin());
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "BAD_REQUEST");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: mangler date → 400 BAD_REQUEST; ingen write", async () => {
    scopeOr401Mock.mockResolvedValue(authedSuperadmin());
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companyId: CID }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "BAD_REQUEST");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: tom body → 400 BAD_REQUEST; ingen write", async () => {
    scopeOr401Mock.mockResolvedValue(authedSuperadmin());
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "BAD_REQUEST");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: ugyldig date-format → 400 MATERIALIZE_FAILED; ingen write", async () => {
    scopeOr401Mock.mockResolvedValue(authedSuperadmin());
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "not-valid-iso", companyId: CID }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "MATERIALIZE_FAILED");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: ugyldig companyId → 400 MATERIALIZE_FAILED; ingen write", async () => {
    scopeOr401Mock.mockResolvedValue(authedSuperadmin());
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: "not-a-uuid" }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "MATERIALIZE_FAILED");
    expect(String(j?.message ?? "")).toMatch(/company/i);
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: feil feltnavn → 400 BAD_REQUEST; ingen write", async () => {
    scopeOr401Mock.mockResolvedValue(authedSuperadmin());
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delivery_date: DATE, company_id: CID }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, j, 400, "BAD_REQUEST");
    assertNoSnapshotWrite(adminHolder.admin);
  });
});

function authedRole(role: string, companyId: string | null = null): { ok: true; ctx: AuthedCtx } {
  return {
    ok: true,
    ctx: {
      rid: "rid_snap_auth",
      route: "/api/superadmin/production-operative-snapshot/materialize",
      method: "POST",
      scope: {
        userId: "88888888-8888-4888-8888-888888888888",
        role,
        companyId,
        locationId: null,
        email: "user@test.no",
        sub: "sub-u",
      },
    },
  };
}

function scopeDenied401(): { ok: false; res: Response; response: Response; ctx: AuthedCtx } {
  const rid = "rid_snap_401_unauth";
  const payload = {
    ok: false,
    rid,
    message: "Ikke innlogget.",
    status: 401,
    error: "UNAUTHORIZED",
  };
  const res = new Response(JSON.stringify(payload), {
    status: 401,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-rid": rid,
      "cache-control": "no-store, max-age=0",
      pragma: "no-cache",
      expires: "0",
      "surrogate-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
  return {
    ok: false,
    res,
    response: res,
    ctx: {
      rid,
      route: "/api/superadmin/production-operative-snapshot/materialize",
      method: "POST",
      scope: {
        userId: null,
        role: null,
        companyId: null,
        locationId: null,
        email: null,
        sub: null,
      },
    },
  };
}

describe("production-operative-snapshot materialize — auth / access-contract", () => {
  let prevCronAuth: string | undefined;

  beforeEach(() => {
    upsertPayloads.length = 0;
    prevCronAuth = process.env.CRON_SECRET;
    process.env.CRON_SECRET = CRON;
  });

  afterEach(() => {
    if (prevCronAuth !== undefined) process.env.CRON_SECRET = prevCronAuth;
    else delete process.env.CRON_SECRET;
    adminHolder.admin = null;
    vi.clearAllMocks();
  });

  it("internal: mangler Authorization og x-cron-secret → 403; ingen upsert eller persistert snapshot", async () => {
    adminHolder.admin = createChainAdmin({
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
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, body, 403, "forbidden");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("internal: feil Bearer → 403; ingen upsert", async () => {
    adminHolder.admin = createChainAdmin({
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
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret-value", "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, body, 403, "forbidden");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("internal: korrekt x-cron-secret uten Bearer → 200 og upsert (canonical alternativ gate)", async () => {
    adminHolder.admin = createChainAdmin({
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
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "x-cron-secret": CRON, "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const j = (await readJson(res)) as Record<string, unknown>;
    assertApiOkMaterializeEnvelope(res, j);
    expect(upsertPayloads.length).toBe(1);
  });

  it("internal: feil x-cron-secret → 403; ingen upsert", async () => {
    adminHolder.admin = createChainAdmin({ orders: [], day_choices: [] });
    const { POST } = await import("@/app/api/internal/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/internal/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "x-cron-secret": "not-the-secret", "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, body, 403, "forbidden");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: scopeOr401 ikke innlogget → 401; ingen upsert", async () => {
    scopeOr401Mock.mockResolvedValue(scopeDenied401());
    adminHolder.admin = createChainAdmin({
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
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, body, 401, "UNAUTHORIZED");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: company_admin → 403; ingen upsert", async () => {
    scopeOr401Mock.mockResolvedValue(authedRole("company_admin", CID));
    adminHolder.admin = createChainAdmin({
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
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, body, 403, "FORBIDDEN");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: kitchen → 403; ingen upsert", async () => {
    scopeOr401Mock.mockResolvedValue(authedRole("kitchen", CID));
    adminHolder.admin = createChainAdmin({
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
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, body, 403, "FORBIDDEN");
    assertNoSnapshotWrite(adminHolder.admin);
  });

  it("superadmin: employee → 403; ingen upsert", async () => {
    scopeOr401Mock.mockResolvedValue(authedRole("employee", CID));
    adminHolder.admin = createChainAdmin({
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
    const { POST } = await import("@/app/api/superadmin/production-operative-snapshot/materialize/route");
    const req = new NextRequest("http://localhost/api/superadmin/production-operative-snapshot/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: DATE, companyId: CID }),
    });
    const res = await POST(req);
    const body = (await readJson(res)) as Record<string, unknown>;
    assertApiErrEnvelope(res, body, 403, "FORBIDDEN");
    assertNoSnapshotWrite(adminHolder.admin);
  });
});
