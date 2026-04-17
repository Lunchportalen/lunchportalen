import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fetchKitchenList, normalizeKitchenApiResponse } from "@/lib/kitchen/kitchenFetch";

describe("normalizeKitchenApiResponse", () => {
  test("unwraps jsonOk envelope { ok, data }", () => {
    const out = normalizeKitchenApiResponse("2026-03-28", {
      ok: true,
      rid: "r1",
      data: {
        date: "2026-03-28",
        summary: { orders: 3, companies: 1, people: 2 },
        rows: [
          {
            orderId: "o1",
            slot: "lunch",
            orderStatus: "ACTIVE",
            company: "Acme",
            location: "Hovedkontor",
            employeeName: "Kari",
            menu_title: "Dagens",
          },
        ],
      },
    });

    expect(out.ok).toBe(true);
    expect(out.date).toBe("2026-03-28");
    expect(out.summary.orders).toBe(3);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]?.company).toBe("Acme");
  });

  test("returns ok:false when envelope ok is false", () => {
    const out = normalizeKitchenApiResponse("2026-03-28", {
      ok: false,
      message: "Nei",
    });
    expect(out.ok).toBe(false);
    expect(out.rows).toHaveLength(0);
    expect(out.reason).toBe("ERROR");
    expect(out.detail).toBe("Nei");
    expect(out.production_operative_snapshot).toBeUndefined();
  });

  test("API/UI-paritet live-path: ingen production_operative_snapshot; canonical rader matcher summary.orders", () => {
    const oid1 = "00000001-0001-4001-8001-000000000001";
    const oid2 = "00000002-0002-4002-8002-000000000002";
    const out = normalizeKitchenApiResponse("2026-04-13", {
      ok: true,
      rid: "r-live",
      data: {
        date: "2026-04-13",
        summary: { orders: 2, companies: 1, people: 2 },
        rows: [
          {
            orderId: oid1,
            slot: "lunch",
            orderStatus: "ACTIVE",
            company: "Acme",
            location: "Hoved",
            employeeName: "Kari",
            menu_title: "Dagens",
          },
          {
            orderId: oid2,
            slot: "lunch",
            orderStatus: "ACTIVE",
            company: "Acme",
            location: "Hoved",
            employeeName: "Per",
            menu_title: "Dagens",
          },
        ],
      },
    });
    expect(out.ok).toBe(true);
    expect(out.production_operative_snapshot).toBeUndefined();
    expect(out.reason).toBeUndefined();
    expect(out.rows).toHaveLength(2);
    expect(out.summary.orders).toBe(out.rows.length);
    // KitchenProductionPanel: liste når ok && summary.orders > 0
    expect(out.ok && (out.summary?.orders ?? 0) > 0).toBe(true);
  });

  test("API/UI-paritet frozen-path: production_operative_snapshot kun når API har active + captured_order_ids; matcher vist mengde", () => {
    const oid1 = "00000001-0001-4001-8001-000000000001";
    const out = normalizeKitchenApiResponse("2026-04-13", {
      ok: true,
      rid: "r-fr",
      data: {
        date: "2026-04-13",
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [
          {
            orderId: oid1,
            slot: "lunch",
            orderStatus: "ACTIVE",
            company: "Acme",
            location: "Hoved",
            employeeName: "Kari",
            menu_title: "Dagens",
          },
        ],
        production_operative_snapshot: {
          active: true,
          frozen_at: "2026-04-13T08:00:00.000Z",
          captured_order_ids: 1,
        },
      },
    });
    expect(out.ok).toBe(true);
    expect(out.production_operative_snapshot?.active).toBe(true);
    expect(out.production_operative_snapshot?.captured_order_ids).toBe(1);
    expect(out.production_operative_snapshot?.frozen_at).toBe("2026-04-13T08:00:00.000Z");
    expect(out.rows).toHaveLength(1);
    expect(out.summary.orders).toBe(out.rows.length);
    expect(out.ok && (out.summary?.orders ?? 0) > 0).toBe(true);
  });

  test("API/UI-paritet NO_ORDERS: reason + tom liste; ingen snapshot (UI tom-dag uten falsk frozen-signal)", () => {
    const out = normalizeKitchenApiResponse("2026-04-13", {
      ok: true,
      rid: "r-no",
      data: {
        date: "2026-04-13",
        summary: { orders: 0, companies: 0, people: 0 },
        rows: [],
        reason: "NO_ORDERS",
      },
    });
    expect(out.ok).toBe(true);
    expect(out.reason).toBe("NO_ORDERS");
    expect(out.rows).toHaveLength(0);
    expect(out.summary.orders).toBe(0);
    expect(out.production_operative_snapshot).toBeUndefined();
    expect(out.ok && (out.summary?.orders ?? 0) > 0).toBe(false);
  });

  test("API/UI-paritet NOT_DELIVERY_DAY: reason til EmptyState; ingen snapshot", () => {
    const out = normalizeKitchenApiResponse("2026-04-11", {
      ok: true,
      rid: "r-nd",
      data: {
        date: "2026-04-11",
        summary: { orders: 0, companies: 0, people: 0 },
        rows: [],
        reason: "NOT_DELIVERY_DAY",
      },
    });
    expect(out.reason).toBe("NOT_DELIVERY_DAY");
    expect(out.production_operative_snapshot).toBeUndefined();
    expect(out.ok && (out.summary?.orders ?? 0) > 0).toBe(false);
  });

  test("fail-closed normalize: snapshot med active:true men uten captured_order_ids-nøkkel → ingen production_operative_snapshot i UI-modell", () => {
    const out = normalizeKitchenApiResponse("2026-04-13", {
      ok: true,
      rid: "r-bad",
      data: {
        date: "2026-04-13",
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [
          {
            orderId: "00000001-0001-4001-8001-000000000001",
            slot: "lunch",
            orderStatus: "ACTIVE",
            company: "Acme",
            location: "Hoved",
            employeeName: "Kari",
            menu_title: "Dagens",
          },
        ],
        production_operative_snapshot: { active: true, frozen_at: "2026-04-13T08:00:00.000Z" },
      },
    });
    expect(out.production_operative_snapshot).toBeUndefined();
  });
});

describe("normalizeKitchenApiResponse — refresh/remount parity (stateless: siste respons = eneste sannhet for UI-state)", () => {
  const D = "2026-04-13";
  const O1 = "00000001-0001-4001-8001-000000000001";
  const O2 = "00000002-0002-4002-8002-000000000002";
  const row = (id: string, name: string) => ({
    orderId: id,
    slot: "lunch",
    orderStatus: "ACTIVE",
    company: "Acme",
    location: "Hoved",
    employeeName: name,
    menu_title: "Dagens",
  });

  test("refresh live → frozen: andre kall har frozen-meta; ingen merge av forrige rad-mengde", () => {
    const first = normalizeKitchenApiResponse(D, {
      ok: true,
      rid: "t1",
      data: {
        date: D,
        summary: { orders: 2, companies: 1, people: 2 },
        rows: [row(O1, "A"), row(O2, "B")],
      },
    });
    const second = normalizeKitchenApiResponse(D, {
      ok: true,
      rid: "t2",
      data: {
        date: D,
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [row(O1, "A")],
        production_operative_snapshot: {
          active: true,
          frozen_at: `${D}T08:00:00.000Z`,
          captured_order_ids: 1,
        },
      },
    });
    expect(first.production_operative_snapshot).toBeUndefined();
    expect(first.rows).toHaveLength(2);
    expect(second.production_operative_snapshot?.active).toBe(true);
    expect(second.rows.map((r) => r.orderId)).toEqual([O1]);
    expect(second.summary.orders).toBe(1);
  });

  test("refresh frozen → live: siste kall uten snapshot; ingen stale frozen-meta", () => {
    const first = normalizeKitchenApiResponse(D, {
      ok: true,
      rid: "t1",
      data: {
        date: D,
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [row(O1, "A")],
        production_operative_snapshot: {
          active: true,
          frozen_at: `${D}T08:00:00.000Z`,
          captured_order_ids: 1,
        },
      },
    });
    const second = normalizeKitchenApiResponse(D, {
      ok: true,
      rid: "t2",
      data: {
        date: D,
        summary: { orders: 2, companies: 1, people: 2 },
        rows: [row(O1, "A"), row(O2, "B")],
      },
    });
    expect(first.production_operative_snapshot).toBeDefined();
    expect(second.production_operative_snapshot).toBeUndefined();
    expect(second.rows).toHaveLength(2);
  });

  test("refresh med rader → NO_ORDERS: tom liste og reason; ingen stale rows/summary", () => {
    const first = normalizeKitchenApiResponse(D, {
      ok: true,
      rid: "t1",
      data: {
        date: D,
        summary: { orders: 2, companies: 1, people: 2 },
        rows: [row(O1, "A"), row(O2, "B")],
      },
    });
    const second = normalizeKitchenApiResponse(D, {
      ok: true,
      rid: "t2",
      data: {
        date: D,
        summary: { orders: 0, companies: 0, people: 0 },
        rows: [],
        reason: "NO_ORDERS",
      },
    });
    expect(first.rows).toHaveLength(2);
    expect(second.rows).toHaveLength(0);
    expect(second.reason).toBe("NO_ORDERS");
    expect(second.summary.orders).toBe(0);
    expect(second.production_operative_snapshot).toBeUndefined();
  });

  test("remount: samme rå JSON normalisert to ganger → identisk utdata (ingen skjult lokal state i normalize)", () => {
    const raw = {
      ok: true,
      rid: "same",
      data: {
        date: D,
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [row(O1, "A")],
        production_operative_snapshot: {
          active: true,
          frozen_at: `${D}T08:00:00.000Z`,
          captured_order_ids: 1,
        },
      },
    };
    const a = normalizeKitchenApiResponse(D, raw);
    const b = normalizeKitchenApiResponse(D, raw);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("normalizeKitchenApiResponse — failure-surface (ikke forveksle med NO_ORDERS / frozen)", () => {
  const D = "2026-04-13";
  const O1 = "00000001-0001-4001-8001-000000000001";
  const row = () => ({
    orderId: O1,
    slot: "lunch",
    orderStatus: "ACTIVE",
    company: "Acme",
    location: "Hoved",
    employeeName: "Kari",
    menu_title: "Dagens",
  });

  test("jsonErr: ok:false er ERROR — ikke NO_ORDERS; ingen snapshot", () => {
    const out = normalizeKitchenApiResponse(D, {
      ok: false,
      rid: "e1",
      message: "Ikke tilgang",
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("ERROR");
    expect(out.rows).toHaveLength(0);
    expect(out.production_operative_snapshot).toBeUndefined();
  });

  test("refresh failure etter gyldig data: andre kall ok:false — feilflate erstatter; ingen merge av rader", () => {
    const okFirst = normalizeKitchenApiResponse(D, {
      ok: true,
      rid: "ok",
      data: { date: D, summary: { orders: 1, companies: 1, people: 1 }, rows: [row()] },
    });
    const errSecond = normalizeKitchenApiResponse(D, { ok: false, rid: "bad", message: "nettverk" });
    expect(okFirst.ok).toBe(true);
    expect(okFirst.rows).toHaveLength(1);
    expect(errSecond.ok).toBe(false);
    expect(errSecond.reason).toBe("ERROR");
    expect(errSecond.rows).toHaveLength(0);
    expect(errSecond.production_operative_snapshot).toBeUndefined();
  });

  test("recovery etter feil: første ok:false, andre ok:true — canonical suksess uten ERROR-reason", () => {
    const errFirst = normalizeKitchenApiResponse(D, { ok: false, message: "x" });
    const okSecond = normalizeKitchenApiResponse(D, {
      ok: true,
      rid: "ok",
      data: { date: D, summary: { orders: 1, companies: 1, people: 1 }, rows: [row()] },
    });
    expect(errFirst.ok).toBe(false);
    expect(okSecond.ok).toBe(true);
    expect(okSecond.reason).not.toBe("ERROR");
    expect(okSecond.rows).toHaveLength(1);
  });

  test("kantflate: ok:true uten data-nøkkel — tomt innhold; ikke jsonErr; ikke frozen-meta", () => {
    const out = normalizeKitchenApiResponse(D, { ok: true, rid: "nodata" });
    expect(out.ok).toBe(true);
    expect(out.rows).toHaveLength(0);
    expect(out.reason).toBeUndefined();
    expect(out.production_operative_snapshot).toBeUndefined();
  });
});

describe("fetchKitchenList — HTTP failure surface (first-load; maps til samme failure-semantikk som ved ugyldig body)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "",
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("HTTP 500 → ok:false, ERROR, detail HTTP 500; ikke NO_ORDERS", async () => {
    const out = await fetchKitchenList("2026-04-13");
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("ERROR");
    expect(out.detail).toContain("500");
    expect(out.rows).toHaveLength(0);
    expect(out.production_operative_snapshot).toBeUndefined();
  });

  test("HTTP 401 → AUTH_REQUIRED (API scopeOr401-paritet; ikke NO_ORDERS / ikke frozen — samme faglige avvisning som manglende session)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "",
      }),
    );
    const out = await fetchKitchenList("2026-04-13");
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("AUTH_REQUIRED");
    expect(out.reason).not.toBe("NO_ORDERS");
    expect(out.rows).toHaveLength(0);
    expect(out.production_operative_snapshot).toBeUndefined();
  });

  test("HTTP 200 men ugyldig JSON (null parse) → normalize får null → ERROR; ikke tom suksess med rader", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "not-json{",
      }),
    );
    const out = await fetchKitchenList("2026-04-13");
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("ERROR");
    expect(out.rows).toHaveLength(0);
  });
});

describe("fetchKitchenList — refresh failure etter suksess (to fetch-kall)", () => {
  const D = "2026-04-13";
  const bodyOk = JSON.stringify({
    ok: true,
    rid: "ok",
    data: {
      date: D,
      summary: { orders: 1, companies: 1, people: 1 },
      rows: [
        {
          orderId: "00000001-0001-4001-8001-000000000001",
          slot: "lunch",
          orderStatus: "ACTIVE",
          company: "Acme",
          location: "Hoved",
          employeeName: "Kari",
          menu_title: "Dagens",
        },
      ],
    },
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("første 200 jsonOk, andre HTTP 500 — andre respons er ERROR uten merge av første rader inn i feilobjektet", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => bodyOk })
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "" }),
    );
    const first = await fetchKitchenList(D);
    const second = await fetchKitchenList(D);
    expect(first.ok).toBe(true);
    expect(first.rows).toHaveLength(1);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("ERROR");
    expect(second.rows).toHaveLength(0);
    expect(second.production_operative_snapshot).toBeUndefined();
  });
});

describe("fetchKitchenList — retry / refresh recovery parity (første forsøk feiler → nytt forsøk lykkes; siste respons eneste sannhet)", () => {
  const D = "2026-04-13";
  const O1 = "00000001-0001-4001-8001-000000000001";
  const O2 = "00000002-0002-4002-8002-000000000002";
  const row = (id: string, name: string) => ({
    orderId: id,
    slot: "lunch",
    orderStatus: "ACTIVE",
    company: "Acme",
    location: "Hoved",
    employeeName: name,
    menu_title: "Dagens",
  });

  const bodyLive = JSON.stringify({
    ok: true,
    rid: "live",
    data: {
      date: D,
      summary: { orders: 2, companies: 1, people: 2 },
      rows: [row(O1, "A"), row(O2, "B")],
    },
  });

  const bodyFrozen = JSON.stringify({
    ok: true,
    rid: "frozen",
    data: {
      date: D,
      summary: { orders: 1, companies: 1, people: 1 },
      rows: [row(O1, "A")],
      production_operative_snapshot: {
        active: true,
        frozen_at: `${D}T08:00:00.000Z`,
        captured_order_ids: 1,
      },
    },
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("first-load retry: HTTP 500 → deretter 200 live — recovery uten ERROR; ingen snapshot; rows matcher live-grunnlag", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "" })
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => bodyLive }),
    );
    const failed = await fetchKitchenList(D);
    const recovered = await fetchKitchenList(D);
    expect(failed.ok).toBe(false);
    expect(failed.reason).toBe("ERROR");
    expect(recovered.ok).toBe(true);
    expect(recovered.reason).not.toBe("ERROR");
    expect(recovered.production_operative_snapshot).toBeUndefined();
    expect(recovered.rows.map((r) => r.orderId).sort()).toEqual([O1, O2].sort());
    expect(recovered.summary.orders).toBe(2);
  });

  test("first-load retry: HTTP 500 → deretter 200 frozen-path — recovery med production_operative_snapshot; ingen stale ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "" })
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => bodyFrozen }),
    );
    const failed = await fetchKitchenList(D);
    const recovered = await fetchKitchenList(D);
    expect(failed.ok).toBe(false);
    expect(recovered.ok).toBe(true);
    expect(recovered.production_operative_snapshot?.active).toBe(true);
    expect(recovered.production_operative_snapshot?.captured_order_ids).toBe(1);
    expect(recovered.rows).toHaveLength(1);
    expect(recovered.rows[0]?.orderId).toBe(O1);
  });

  test("refresh: 200 live → HTTP 500 → 200 frozen — tredje respons alene; ingen merge av feil eller gammel live inn i siste", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => bodyLive })
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "" })
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => bodyFrozen }),
    );
    const a = await fetchKitchenList(D);
    const b = await fetchKitchenList(D);
    const c = await fetchKitchenList(D);
    expect(a.ok).toBe(true);
    expect(a.rows).toHaveLength(2);
    expect(b.ok).toBe(false);
    expect(c.ok).toBe(true);
    expect(c.production_operative_snapshot?.active).toBe(true);
    expect(c.rows).toHaveLength(1);
    expect(c.rows[0]?.orderId).toBe(O1);
  });
});

describe("normalizeKitchenApiResponse — date / query navigation parity (dato A → dato B; stateless — ingen stale rows/meta)", () => {
  const DA = "2026-04-10";
  const DB = "2026-04-11";
  const OA = "00000001-0001-4001-8001-000000000001";
  const OB = "00000002-0002-4002-8002-000000000002";
  const OC = "00000003-0003-4003-8003-000000000003";
  const row = (d: string, id: string, name: string) => ({
    orderId: id,
    slot: "lunch",
    orderStatus: "ACTIVE",
    company: "Acme",
    location: "Hoved",
    employeeName: name,
    menu_title: "Dagens",
  });

  test("dato A med rader → dato B med andre rader: kun B sine orderIds; response.date følger B", () => {
    const a = normalizeKitchenApiResponse(DA, {
      ok: true,
      rid: "a",
      data: {
        date: DA,
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [row(DA, OA, "En")],
      },
    });
    const b = normalizeKitchenApiResponse(DB, {
      ok: true,
      rid: "b",
      data: {
        date: DB,
        summary: { orders: 2, companies: 1, people: 2 },
        rows: [row(DB, OB, "To"), row(DB, OC, "Tre")],
      },
    });
    expect(a.date).toBe(DA);
    expect(a.rows.map((r) => r.orderId)).toEqual([OA]);
    expect(b.date).toBe(DB);
    expect(b.rows.map((r) => r.orderId).sort()).toEqual([OB, OC].sort());
    expect(b.rows.some((r) => r.orderId === OA)).toBe(false);
  });

  test("dato A live → dato B frozen: snapshot kun på B; ingen frozen-meta på A-kall", () => {
    const live = normalizeKitchenApiResponse(DA, {
      ok: true,
      rid: "l",
      data: { date: DA, summary: { orders: 1, companies: 1, people: 1 }, rows: [row(DA, OA, "X")] },
    });
    const frozen = normalizeKitchenApiResponse(DB, {
      ok: true,
      rid: "f",
      data: {
        date: DB,
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [row(DB, OB, "Y")],
        production_operative_snapshot: {
          active: true,
          frozen_at: `${DB}T08:00:00.000Z`,
          captured_order_ids: 1,
        },
      },
    });
    expect(live.production_operative_snapshot).toBeUndefined();
    expect(frozen.production_operative_snapshot?.active).toBe(true);
    expect(frozen.date).toBe(DB);
    expect(frozen.rows[0]?.orderId).toBe(OB);
  });

  test("dato A frozen → dato B live: frozen-meta borte på B; rader fra B", () => {
    const frozen = normalizeKitchenApiResponse(DA, {
      ok: true,
      rid: "f",
      data: {
        date: DA,
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [row(DA, OA, "X")],
        production_operative_snapshot: {
          active: true,
          frozen_at: `${DA}T08:00:00.000Z`,
          captured_order_ids: 1,
        },
      },
    });
    const live = normalizeKitchenApiResponse(DB, {
      ok: true,
      rid: "l",
      data: {
        date: DB,
        summary: { orders: 2, companies: 1, people: 2 },
        rows: [row(DB, OB, "P"), row(DB, OC, "Q")],
      },
    });
    expect(frozen.production_operative_snapshot).toBeDefined();
    expect(live.production_operative_snapshot).toBeUndefined();
    expect(live.rows).toHaveLength(2);
    expect(live.date).toBe(DB);
  });

  test("dato A med data → dato B NO_ORDERS: tom B; reason NO_ORDERS; ingen rader fra A", () => {
    const withRows = normalizeKitchenApiResponse(DA, {
      ok: true,
      rid: "w",
      data: { date: DA, summary: { orders: 2, companies: 1, people: 2 }, rows: [row(DA, OA, "A"), row(DA, OB, "B")] },
    });
    const empty = normalizeKitchenApiResponse(DB, {
      ok: true,
      rid: "e",
      data: {
        date: DB,
        summary: { orders: 0, companies: 0, people: 0 },
        rows: [],
        reason: "NO_ORDERS",
      },
    });
    expect(withRows.rows).toHaveLength(2);
    expect(empty.date).toBe(DB);
    expect(empty.reason).toBe("NO_ORDERS");
    expect(empty.rows).toHaveLength(0);
    expect(empty.production_operative_snapshot).toBeUndefined();
  });
});

describe("fetchKitchenList — date navigation (request-date ↔ response.date; URL-styrt mock)", () => {
  const DA = "2026-04-10";
  const DB = "2026-04-11";
  const O1 = "00000001-0001-4001-8001-000000000001";
  const O2 = "00000002-0002-4002-8002-000000000002";

  function mkBody(
    d: string,
    kind: "live" | "frozen" | "no_orders",
  ): string {
    const baseRow = {
      orderId: O1,
      slot: "lunch",
      orderStatus: "ACTIVE",
      company: "Acme",
      location: "Hoved",
      employeeName: "Kari",
      menu_title: "Dagens",
    };
    if (kind === "no_orders") {
      return JSON.stringify({
        ok: true,
        rid: "no",
        data: {
          date: d,
          summary: { orders: 0, companies: 0, people: 0 },
          rows: [],
          reason: "NO_ORDERS",
        },
      });
    }
    if (kind === "live") {
      return JSON.stringify({
        ok: true,
        rid: "live",
        data: {
          date: d,
          summary: { orders: 1, companies: 1, people: 1 },
          rows: [baseRow],
        },
      });
    }
    return JSON.stringify({
      ok: true,
      rid: "fr",
      data: {
        date: d,
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [{ ...baseRow, orderId: O2 }],
        production_operative_snapshot: {
          active: true,
          frozen_at: `${d}T08:00:00.000Z`,
          captured_order_ids: 1,
        },
      },
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("hent dato A deretter dato B: response.date og rows følger valgt dato; ingen stale orderId fra A på B", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        const m = url.match(/[?&]date=([^&]+)/);
        const d = m ? decodeURIComponent(m[1]) : "";
        const body = d === DA ? mkBody(DA, "live") : d === DB ? mkBody(DB, "live") : JSON.stringify({ ok: false, message: "bad date" });
        return Promise.resolve({ ok: true, status: 200, text: async () => body });
      }),
    );
    const a = await fetchKitchenList(DA);
    const b = await fetchKitchenList(DB);
    expect(a.ok).toBe(true);
    expect(a.date).toBe(DA);
    expect(a.rows[0]?.orderId).toBe(O1);
    expect(b.ok).toBe(true);
    expect(b.date).toBe(DB);
    expect(b.rows[0]?.orderId).toBe(O1);
    expect(b.rows.some((r) => r.orderId === O2)).toBe(false);
  });

  test("samme navigasjon A live → B frozen: B har snapshot og annen orderId; A uten snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        const m = url.match(/[?&]date=([^&]+)/);
        const d = m ? decodeURIComponent(m[1]) : "";
        const body = d === DA ? mkBody(DA, "live") : d === DB ? mkBody(DB, "frozen") : JSON.stringify({ ok: false, message: "bad" });
        return Promise.resolve({ ok: true, status: 200, text: async () => body });
      }),
    );
    const a = await fetchKitchenList(DA);
    const b = await fetchKitchenList(DB);
    expect(a.production_operative_snapshot).toBeUndefined();
    expect(b.production_operative_snapshot?.active).toBe(true);
    expect(b.rows[0]?.orderId).toBe(O2);
    expect(b.date).toBe(DB);
  });

  test("dato A med rad → dato B NO_ORDERS: B har tom liste og reason; ingen meta fra A", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        const m = url.match(/[?&]date=([^&]+)/);
        const d = m ? decodeURIComponent(m[1]) : "";
        const body = d === DA ? mkBody(DA, "live") : d === DB ? mkBody(DB, "no_orders") : JSON.stringify({ ok: false, message: "bad" });
        return Promise.resolve({ ok: true, status: 200, text: async () => body });
      }),
    );
    const a = await fetchKitchenList(DA);
    const b = await fetchKitchenList(DB);
    expect(a.rows).toHaveLength(1);
    expect(b.ok).toBe(true);
    expect(b.date).toBe(DB);
    expect(b.reason).toBe("NO_ORDERS");
    expect(b.rows).toHaveLength(0);
    expect(b.production_operative_snapshot).toBeUndefined();
  });
});

describe("fetchKitchenList — request / URL contract (lib/kitchen/kitchenFetch.ts: GET + date-query + encodeURIComponent)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("kaller fetch med /api/kitchen?date=<encodeURIComponent(dateISO)> og { method: GET, cache: no-store }", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          rid: "x",
          data: {
            date: "2026-07-01",
            summary: { orders: 0, companies: 0, people: 0 },
            rows: [],
            reason: "NO_ORDERS",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await fetchKitchenList("2026-07-01");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/kitchen?date=${encodeURIComponent("2026-07-01")}`);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ method: "GET", cache: "no-store" });
  });

  test("dato A → dato B: hvert kall egen URL; ingen gjenbruk av første query", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const m = url.match(/[?&]date=([^&]+)/);
      const d = m ? decodeURIComponent(m[1]) : "";
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            rid: "x",
            data: {
              date: d,
              summary: { orders: 0, companies: 0, people: 0 },
              rows: [],
              reason: "NO_ORDERS",
            },
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const DA = "2026-05-20";
    const DB = "2026-05-21";
    const rA = await fetchKitchenList(DA);
    const rB = await fetchKitchenList(DB);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/kitchen?date=${encodeURIComponent(DA)}`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/kitchen?date=${encodeURIComponent(DB)}`);
    expect(fetchMock.mock.calls[0]?.[0]).not.toBe(fetchMock.mock.calls[1]?.[0]);
    expect(rA.date).toBe(DA);
    expect(rB.date).toBe(DB);
  });
});

describe("fetchKitchenList — cache / no-store (lib/kitchen/kitchenFetch.ts: hvert kall GET + cache:no-store; siste 200-body er eneste sannhet)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const O1 = "00000001-0001-4001-8001-000000000001";
  const O2 = "00000002-0002-4002-8002-000000000002";
  const D = "2026-08-10";

  test("gjentatte kall med samme dato: hvert fetch-init har cache:no-store; ny body per kall erstatter forrige (ingen klient-cache)", async () => {
    let n = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      n += 1;
      const body =
        n === 1
          ? {
              ok: true,
              rid: "1",
              data: {
                date: D,
                summary: { orders: 1, companies: 1, people: 1 },
                rows: [
                  {
                    orderId: O1,
                    slot: "lunch",
                    orderStatus: "ACTIVE",
                    company: "A",
                    location: "L",
                    employeeName: "E",
                    menu_title: "D",
                  },
                ],
              },
            }
          : {
              ok: true,
              rid: "2",
              data: {
                date: D,
                summary: { orders: 0, companies: 0, people: 0 },
                rows: [],
                reason: "NO_ORDERS",
              },
            };
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const r1 = await fetchKitchenList(D);
    const r2 = await fetchKitchenList(D);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ method: "GET", cache: "no-store" });
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({ method: "GET", cache: "no-store" });
    expect(r1.rows).toHaveLength(1);
    expect(r2.reason).toBe("NO_ORDERS");
    expect(r2.rows).toHaveLength(0);
    expect(r2.summary.orders).toBe(0);
  });

  test("live → frozen → live (samme dato, tre nettverkskall): ingen snapshot-stale etter siste live; fetch kalles tre ganger med no-store", async () => {
    let n = 0;
    const row = (id: string) => ({
      orderId: id,
      slot: "lunch",
      orderStatus: "ACTIVE",
      company: "A",
      location: "L",
      employeeName: "E",
      menu_title: "D",
    });
    const fetchMock = vi.fn().mockImplementation(() => {
      n += 1;
      if (n === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              ok: true,
              rid: "l",
              data: { date: D, summary: { orders: 1, companies: 1, people: 1 }, rows: [row(O1)] },
            }),
        });
      }
      if (n === 2) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              ok: true,
              rid: "f",
              data: {
                date: D,
                summary: { orders: 1, companies: 1, people: 1 },
                rows: [row(O1)],
                production_operative_snapshot: {
                  active: true,
                  frozen_at: `${D}T08:00:00.000Z`,
                  captured_order_ids: 1,
                },
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            rid: "l2",
            data: { date: D, summary: { orders: 1, companies: 1, people: 1 }, rows: [row(O2)] },
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const a = await fetchKitchenList(D);
    const b = await fetchKitchenList(D);
    const c = await fetchKitchenList(D);
    expect(fetchMock.mock.calls.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(fetchMock.mock.calls[i]?.[1]).toEqual({ method: "GET", cache: "no-store" });
    }
    expect(a.production_operative_snapshot).toBeUndefined();
    expect(b.production_operative_snapshot?.active).toBe(true);
    expect(c.production_operative_snapshot).toBeUndefined();
    expect(c.rows[0]?.orderId).toBe(O2);
  });
});

describe("SSR / page-loader parity (app/kitchen/page.tsx: ingen server-injektert kitchen JSON; first-load = fetchKitchenList → normalizeKitchenApiResponse)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const O1 = "00000001-0001-4001-8001-000000000001";
  const D = "2026-06-01";

  test("live-path: fetchKitchenList(200) matcher normalizeKitchenApiResponse på samme jsonOk-body; ingen falsk frozen-meta", async () => {
    const envelope = {
      ok: true,
      rid: "r-live",
      data: {
        date: D,
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [
          {
            orderId: O1,
            slot: "lunch",
            orderStatus: "ACTIVE",
            company: "Acme",
            location: "Hoved",
            employeeName: "Kari",
            menu_title: "Dagens",
          },
        ],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(envelope),
    });
    vi.stubGlobal("fetch", fetchMock);
    const viaFetch = await fetchKitchenList(D);
    const viaNorm = normalizeKitchenApiResponse(D, envelope);
    expect(viaFetch).toEqual(viaNorm);
    expect(viaFetch.production_operative_snapshot).toBeUndefined();
  });

  test("frozen-path: production_operative_snapshot i body; fetch og normalize gir identisk KitchenResp", async () => {
    const envelope = {
      ok: true,
      rid: "r-fr",
      data: {
        date: D,
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [
          {
            orderId: O1,
            slot: "lunch",
            orderStatus: "ACTIVE",
            company: "Acme",
            location: "Hoved",
            employeeName: "Kari",
            menu_title: "Dagens",
          },
        ],
        production_operative_snapshot: {
          active: true,
          frozen_at: "2026-06-01T08:00:00.000Z",
          captured_order_ids: 1,
        },
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(envelope),
    });
    vi.stubGlobal("fetch", fetchMock);
    const viaFetch = await fetchKitchenList(D);
    const viaNorm = normalizeKitchenApiResponse(D, envelope);
    expect(viaFetch).toEqual(viaNorm);
    expect(viaFetch.production_operative_snapshot?.active).toBe(true);
  });

  test("NO_ORDERS: rows tomme + summary nullstilt; fetch matcher normalize; ingen falsk snapshot", async () => {
    const envelope = {
      ok: true,
      rid: "r-no",
      data: {
        date: D,
        summary: { orders: 0, companies: 0, people: 0 },
        rows: [],
        reason: "NO_ORDERS",
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(envelope),
    });
    vi.stubGlobal("fetch", fetchMock);
    const viaFetch = await fetchKitchenList(D);
    const viaNorm = normalizeKitchenApiResponse(D, envelope);
    expect(viaFetch).toEqual(viaNorm);
    expect(viaFetch.reason).toBe("NO_ORDERS");
    expect(viaFetch.production_operative_snapshot).toBeUndefined();
  });

  test("first-load og refresh: to fetch med samme 200-body → identisk KitchenResp (ingen annen SSR-sannhet)", async () => {
    const envelope = {
      ok: true,
      rid: "r",
      data: {
        date: D,
        summary: { orders: 1, companies: 1, people: 1 },
        rows: [
          {
            orderId: O1,
            slot: "lunch",
            orderStatus: "ACTIVE",
            company: "Acme",
            location: "Hoved",
            employeeName: "Kari",
            menu_title: "Dagens",
          },
        ],
      },
    };
    const body = JSON.stringify(envelope);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => body,
    });
    vi.stubGlobal("fetch", fetchMock);
    const first = await fetchKitchenList(D);
    const second = await fetchKitchenList(D);
    expect(first).toEqual(second);
    expect(fetchMock.mock.calls.length).toBe(2);
  });
});
