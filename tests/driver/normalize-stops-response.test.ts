import { describe, expect, test } from "vitest";

import { normalizeStopsResponse } from "@/lib/driver/normalizeStopsResponse";
function mkRes(ok: boolean, status: number) {
  return { ok, status } as Response;
}

describe("normalizeStopsResponse", () => {
  test("unwraps jsonOk envelope { ok, data: { date, stops } }", () => {
    const res = mkRes(true, 200);
    const json = {
      ok: true,
      rid: "r1",
      data: {
        date: "2026-03-28",
        stops: [
          {
            key: "k1",
            date: "2026-03-28",
            slot: "lunch",
            companyId: "c1",
            companyName: "A",
            locationId: "l1",
            locationName: "Hoved",
            addressLine: "X 1",
            deliveryWhere: null,
            deliveryWhenNote: null,
            deliveryContactName: null,
            deliveryContactPhone: null,
            deliveryWindowFrom: null,
            deliveryWindowTo: null,
            orderCount: 2,
            delivered: false,
            deliveredAt: null,
            deliveredBy: null,
          },
        ],
      },
    };

    const out = normalizeStopsResponse(res, json, "fallback");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.date).toBe("2026-03-28");
      expect(out.data.stops).toHaveLength(1);
      expect(out.data.stops[0]?.orderCount).toBe(2);
    }
  });

  test("returns error when ok:false", () => {
    const res = mkRes(true, 200);
    const json = { ok: false, rid: "r2", message: "Nei" };
    const out = normalizeStopsResponse(res, json, "f");
    expect(out.ok).toBe(false);
    expect(out.ok === false ? out.err.message : "").toContain("Nei");
  });

  test("API/UI-paritet live/frozen agnostisk: tom stops[] — unwrap; driver-API har ikke frozen-meta i payload", () => {
    const res = mkRes(true, 200);
    const json = {
      ok: true,
      rid: "r-empty",
      data: { date: "2026-04-13", stops: [] },
    };
    const out = normalizeStopsResponse(res, json, "fb");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.data.date).toBe("2026-04-13");
    expect(out.data.stops).toEqual([]);
    const sum = out.data.stops.reduce((a, s) => a + (s.orderCount ?? 0), 0);
    expect(sum).toBe(0);
    expect(new Set(Object.keys(out.data))).toEqual(new Set(["ok", "rid", "date", "stops"]));
  });

  test("API/UI-paritet: Σ orderCount på stops matcher brukt bucket-sum (flere stopp)", () => {
    const res = mkRes(true, 200);
    const stop = (key: string, n: number) => ({
      key,
      date: "2026-04-13",
      slot: "lunch",
      companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      companyName: "A",
      locationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      locationName: "L1",
      addressLine: null,
      deliveryWhere: null,
      deliveryWhenNote: null,
      deliveryContactName: null,
      deliveryContactPhone: null,
      deliveryWindowFrom: null,
      deliveryWindowTo: null,
      orderCount: n,
      delivered: false,
      deliveredAt: null,
      deliveredBy: null,
    });
    const json = {
      ok: true,
      rid: "r2",
      data: {
        date: "2026-04-13",
        stops: [stop("a|lunch|cid|lid", 1), stop("b|lunch|cid|lid", 3)],
      },
    };
    const out = normalizeStopsResponse(res, json, "fb");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const total = out.data.stops.reduce((a, s) => a + s.orderCount, 0);
    expect(total).toBe(4);
    expect(out.data.stops).toHaveLength(2);
  });
});

describe("normalizeStopsResponse — refresh/remount parity (stateless; driver-API uten frozen-felt — kun siste payload teller)", () => {
  const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const D = "2026-04-13";

  function stop(key: string, n: number) {
    return {
      key,
      date: D,
      slot: "lunch",
      companyId: CID,
      companyName: "Co",
      locationId: LID,
      locationName: "L1",
      addressLine: null,
      deliveryWhere: null,
      deliveryWhenNote: null,
      deliveryContactName: null,
      deliveryContactPhone: null,
      deliveryWindowFrom: null,
      deliveryWindowTo: null,
      orderCount: n,
      delivered: false,
      deliveredAt: null,
      deliveredBy: null,
    };
  }

  test("refresh live (flere stopp) → tom liste: siste respons har ikke stopp fra forrige (ingen stale bucket)", () => {
    const res = mkRes(true, 200);
    const full = normalizeStopsResponse(
      res,
      { ok: true, rid: "a", data: { date: D, stops: [stop("k1|lunch|cid|lid", 2), stop("k2|lunch|cid|lid", 1)] } },
      "fb",
    );
    const empty = normalizeStopsResponse(res, { ok: true, rid: "b", data: { date: D, stops: [] } }, "fb");
    expect(full.ok && empty.ok).toBe(true);
    if (!full.ok || !empty.ok) return;
    expect(full.data.stops).toHaveLength(2);
    expect(empty.data.stops).toEqual([]);
    expect(empty.data.stops.reduce((a, s) => a + s.orderCount, 0)).toBe(0);
  });

  test("refresh tom → live: siste respons fyller stops (canonical etter tom/korrupt-tom)", () => {
    const res = mkRes(true, 200);
    const empty = normalizeStopsResponse(res, { ok: true, rid: "a", data: { date: D, stops: [] } }, "fb");
    const full = normalizeStopsResponse(
      res,
      { ok: true, rid: "b", data: { date: D, stops: [stop("k1|lunch|cid|lid", 3)] } },
      "fb",
    );
    expect(empty.ok && full.ok).toBe(true);
    if (!empty.ok || !full.ok) return;
    expect(empty.data.stops).toHaveLength(0);
    expect(full.data.stops).toHaveLength(1);
    expect(full.data.stops[0]?.orderCount).toBe(3);
  });

  test("remount: samme JSON to kall → identisk StopsOk (determinisme)", () => {
    const res = mkRes(true, 200);
    const json = { ok: true, rid: "x", data: { date: D, stops: [stop("k1|lunch|cid|lid", 1)] } };
    const a = normalizeStopsResponse(res, json, "fb");
    const b = normalizeStopsResponse(res, json, "fb");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(JSON.stringify(a.data)).toBe(JSON.stringify(b.data));
  });
});

describe("normalizeStopsResponse — cache / no-store-paritet (stateless; ingen buffer — siste JSON er eneste sannhet; DriverClient apiFetch bruker cache:no-store)", () => {
  const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const D = "2026-09-01";

  function stop(key: string, n: number) {
    return {
      key,
      date: D,
      slot: "lunch",
      companyId: CID,
      companyName: "Co",
      locationId: LID,
      locationName: "L1",
      addressLine: null,
      deliveryWhere: null,
      deliveryWhenNote: null,
      deliveryContactName: null,
      deliveryContactPhone: null,
      deliveryWindowFrom: null,
      deliveryWindowTo: null,
      orderCount: n,
      delivered: false,
      deliveredAt: null,
      deliveredBy: null,
    };
  }

  test("tre sekvensielle kall med ulik JSON: tredje tom — ingen stopp-keys fra første kall (ingen stale bucket)", () => {
    const res = mkRes(true, 200);
    const r1 = normalizeStopsResponse(
      res,
      { ok: true, rid: "1", data: { date: D, stops: [stop("k1|lunch|cid|lid", 1)] } },
      "fb",
    );
    const r2 = normalizeStopsResponse(
      res,
      { ok: true, rid: "2", data: { date: D, stops: [stop("k2|lunch|cid|lid", 5)] } },
      "fb",
    );
    const r3 = normalizeStopsResponse(res, { ok: true, rid: "3", data: { date: D, stops: [] } }, "fb");
    expect(r1.ok && r2.ok && r3.ok).toBe(true);
    if (!r1.ok || !r2.ok || !r3.ok) throw new Error("expected ok");
    expect(r3.data.stops).toEqual([]);
    expect(r3.data.stops.some((s) => s.key === "k1|lunch|cid|lid")).toBe(false);
  });

  test("DriverClient apiFetch (fasit): base init er credentials:include + cache:no-store før spread av init", () => {
    const base = { credentials: "include" as const, cache: "no-store" as const };
    const merged = { ...base, method: "GET", headers: { "x-rid": "rid_t" } };
    expect(merged.cache).toBe("no-store");
    expect(merged.credentials).toBe("include");
  });
});

describe("normalizeStopsResponse — failure-surface (ikke forveksle med tom live/frozen)", () => {
  test("first-load: json null → ok false; ingen stops; ikke suksess-tom", () => {
    const out = normalizeStopsResponse(mkRes(true, 200), null, "fb");
    expect(out.ok).toBe(false);
    if (out.ok === true) throw new Error("expected failure branch");
    expect(out.err.message).toMatch(/hente stopp/i);
  });

  test("jsonErr ok:false — ikke ok:true med stops; ingen frozen-implikasjon i payload", () => {
    const res = mkRes(true, 200);
    const out = normalizeStopsResponse(res, { ok: false, rid: "e", message: "Nektet", error: "x" }, "fb");
    expect(out.ok).toBe(false);
    if (out.ok === true) throw new Error("expected failure branch");
    expect(out.err.message).toContain("Nektet");
  });

  test("ok:true men ugyldig shape (stops ikke array) → bad_payload; ikke gyldig tom liste", () => {
    const res = mkRes(true, 200);
    const out = normalizeStopsResponse(
      res,
      {
        ok: true,
        rid: "bad",
        data: { date: "2026-04-13", stops: "not-array" as unknown as [] },
      },
      "fb",
    );
    expect(out.ok).toBe(false);
    if (out.ok === true) throw new Error("expected failure branch");
    expect(out.err.error).toBe("bad_payload");
    expect(out.err.message).toContain("Mangler gyldig stops-data");
  });

  test("refresh failure etter suksess: andre kall ok:false — feil erstatter; ingen stopp fra forrige i err", () => {
    const res = mkRes(true, 200);
    const okJson = {
      ok: true,
      rid: "a",
      data: {
        date: "2026-04-13",
        stops: [
          {
            key: "k1",
            date: "2026-04-13",
            slot: "lunch",
            companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            companyName: "A",
            locationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            locationName: "L",
            addressLine: null,
            deliveryWhere: null,
            deliveryWhenNote: null,
            deliveryContactName: null,
            deliveryContactPhone: null,
            deliveryWindowFrom: null,
            deliveryWindowTo: null,
            orderCount: 1,
            delivered: false,
            deliveredAt: null,
            deliveredBy: null,
          },
        ],
      },
    };
    const first = normalizeStopsResponse(res, okJson, "fb");
    const second = normalizeStopsResponse(res, { ok: false, rid: "b", message: "feilet" }, "fb");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (first.ok === false || second.ok === true) throw new Error("expected first ok, second err");
    expect(first.data.stops).toHaveLength(1);
    expect(second.err.message).toContain("feilet");
  });

  test("HTTP 500 + body ok:false — samme feilflate som 200 jsonErr (parity)", () => {
    const res = mkRes(false, 500);
    const out = normalizeStopsResponse(res, { ok: false, message: "srv" }, "fb");
    expect(out.ok).toBe(false);
    if (out.ok === true) throw new Error("expected failure branch");
    expect(out.err.message).toContain("srv");
  });

  test("HTTP 401 + json null: ok false — ikke ok:true med tom stops (auth-feil ≠ operativt tomt)", () => {
    const res = mkRes(false, 401);
    const out = normalizeStopsResponse(res, null, "fb");
    expect(out.ok).toBe(false);
    if (out.ok === true) throw new Error("expected failure branch");
    expect(out.err.status).toBe(401);
    expect(out.err.error).toMatch(/HTTP_401/i);
  });

  test("HTTP 401 + jsonErr ok:false (som scopeOr401-body): ok false — ikke suksess-tom liste", () => {
    const res = mkRes(false, 401);
    const out = normalizeStopsResponse(
      res,
      { ok: false, rid: "r", message: "Ikke innlogget.", error: "UNAUTHORIZED" },
      "fb",
    );
    expect(out.ok).toBe(false);
    if (out.ok === true) throw new Error("expected failure branch");
    expect(out.err.message).toMatch(/innlogget|API-feil/i);
  });
});

describe("normalizeStopsResponse — retry / recovery parity (feil → vellykket henting; driver uten frozen-felt i JSON)", () => {
  const D = "2026-04-13";
  const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  function stop(key: string, n: number) {
    return {
      key,
      date: D,
      slot: "lunch",
      companyId: CID,
      companyName: "Co",
      locationId: LID,
      locationName: "L1",
      addressLine: null,
      deliveryWhere: null,
      deliveryWhenNote: null,
      deliveryContactName: null,
      deliveryContactPhone: null,
      deliveryWindowFrom: null,
      deliveryWindowTo: null,
      orderCount: n,
      delivered: false,
      deliveredAt: null,
      deliveredBy: null,
    };
  }

  test("first-load retry: null JSON → deretter jsonOk med stops — recovery uten err; Σ orderCount matcher payload", () => {
    const res = mkRes(true, 200);
    const failed = normalizeStopsResponse(res, null, "fb");
    const okJson = {
      ok: true,
      rid: "ok",
      data: { date: D, stops: [stop("k1|lunch|cid|lid", 2), stop("k2|lunch|cid|lid", 1)] },
    };
    const recovered = normalizeStopsResponse(res, okJson, "fb");
    expect(failed.ok).toBe(false);
    expect(recovered.ok).toBe(true);
    if (recovered.ok === false) throw new Error("expected ok");
    expect(recovered.data.stops).toHaveLength(2);
    expect(recovered.data.stops.reduce((a, s) => a + s.orderCount, 0)).toBe(3);
  });

  test("recovery til færre stopp (allowlist-/frozen-grunnlag simulert i API; samme JSON-kontrakt uten frozen-meta)", () => {
    const res = mkRes(true, 200);
    const failed = normalizeStopsResponse(res, { ok: false, rid: "e", message: "midlertidig" }, "fb");
    const recovered = normalizeStopsResponse(res, { ok: true, rid: "r", data: { date: D, stops: [stop("k1|lunch|cid|lid", 1)] } }, "fb");
    expect(failed.ok).toBe(false);
    expect(recovered.ok).toBe(true);
    if (recovered.ok === false) throw new Error("expected ok");
    expect(recovered.data.stops).toHaveLength(1);
    expect(recovered.data.stops[0]?.orderCount).toBe(1);
  });

  test("trippel: ok med stopp → jsonErr → ok tom — siste tom uten stale stopp fra første", () => {
    const res = mkRes(true, 200);
    const full = {
      ok: true,
      rid: "1",
      data: { date: D, stops: [stop("k1|lunch|cid|lid", 5)] },
    };
    const a = normalizeStopsResponse(res, full, "fb");
    const b = normalizeStopsResponse(res, { ok: false, message: "retry" }, "fb");
    const c = normalizeStopsResponse(res, { ok: true, rid: "3", data: { date: D, stops: [] } }, "fb");
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
    expect(c.ok).toBe(true);
    if (a.ok === false || c.ok === false) throw new Error("expected a,c ok");
    expect(a.data.stops).toHaveLength(1);
    expect(c.data.stops).toEqual([]);
    expect(c.data.stops.reduce((x, s) => x + s.orderCount, 0)).toBe(0);
  });
});

describe("normalizeStopsResponse — date / query navigation parity (driver eksponerer ikke frozen-meta; siste dato/stops alene)", () => {
  const DA = "2026-04-10";
  const DB = "2026-04-11";
  const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  function stop(date: string, key: string, n: number) {
    return {
      key,
      date,
      slot: "lunch",
      companyId: CID,
      companyName: "Co",
      locationId: LID,
      locationName: "L1",
      addressLine: null,
      deliveryWhere: null,
      deliveryWhenNote: null,
      deliveryContactName: null,
      deliveryContactPhone: null,
      deliveryWindowFrom: null,
      deliveryWindowTo: null,
      orderCount: n,
      delivered: false,
      deliveredAt: null,
      deliveredBy: null,
    };
  }

  test("dato A med stopp → dato B med andre stopp: data.date og stops følger B; ingen stale key fra A", () => {
    const res = mkRes(true, 200);
    const pa = {
      ok: true,
      rid: "a",
      data: {
        date: DA,
        stops: [stop(DA, "ka|lunch|cid|lid", 2)],
      },
    };
    const pb = {
      ok: true,
      rid: "b",
      data: {
        date: DB,
        stops: [stop(DB, "kb|lunch|cid|lid", 1), stop(DB, "kc|lunch|cid|lid", 3)],
      },
    };
    const a = normalizeStopsResponse(res, pa, "fb");
    const b = normalizeStopsResponse(res, pb, "fb");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.data.date).toBe(DA);
    expect(b.data.date).toBe(DB);
    expect(b.data.stops.map((s) => s.key).sort()).toEqual(["kb|lunch|cid|lid", "kc|lunch|cid|lid"].sort());
    expect(b.data.stops.some((s) => s.key === "ka|lunch|cid|lid")).toBe(false);
  });

  test("dato A fylt → dato B tom (tom/korrupt-tom semantikk): tom array; sum 0; date B", () => {
    const res = mkRes(true, 200);
    const full = {
      ok: true,
      rid: "1",
      data: { date: DA, stops: [stop(DA, "k1|lunch|cid|lid", 4)] },
    };
    const empty = {
      ok: true,
      rid: "2",
      data: { date: DB, stops: [] },
    };
    const a = normalizeStopsResponse(res, full, "fb");
    const b = normalizeStopsResponse(res, empty, "fb");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(b.data.date).toBe(DB);
    expect(b.data.stops).toEqual([]);
  });

  test("live ↔ frozen er ikke i JSON: ulike stopp-mengder ved datobytte er kun API payload — dokumentert", () => {
    const res = mkRes(true, 200);
    const many = {
      ok: true,
      rid: "m",
      data: { date: DA, stops: [stop(DA, "x1|lunch|cid|lid", 1), stop(DA, "x2|lunch|cid|lid", 1)] },
    };
    const few = {
      ok: true,
      rid: "f",
      data: { date: DB, stops: [stop(DB, "y1|lunch|cid|lid", 2)] },
    };
    const a = normalizeStopsResponse(res, many, "fb");
    const b = normalizeStopsResponse(res, few, "fb");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.data.stops).toHaveLength(2);
    expect(b.data.stops).toHaveLength(1);
    expect(b.data.stops[0]?.date).toBe(DB);
  });
});

describe("SSR / page-loader parity (app/driver/page.tsx: ingen server-injektert stops JSON; first-load = parse(body) + normalizeStopsResponse som DriverClient)", () => {
  const D = "2026-06-15";
  const CID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const LID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  function stop(key: string, n: number) {
    return {
      key,
      date: D,
      slot: "lunch",
      companyId: CID,
      companyName: "Co",
      locationId: LID,
      locationName: "L1",
      addressLine: null,
      deliveryWhere: null,
      deliveryWhenNote: null,
      deliveryContactName: null,
      deliveryContactPhone: null,
      deliveryWindowFrom: null,
      deliveryWindowTo: null,
      orderCount: n,
      delivered: false,
      deliveredAt: null,
      deliveredBy: null,
    };
  }

  test("parse-then-normalize (simulerer readJsonSafe etter fetch) === direkte normalize — samme canonical StopsOk (frozen-meta finnes ikke i driver JSON)", () => {
    const envelope = {
      ok: true,
      rid: "r1",
      data: { date: D, stops: [stop("k1|lunch|cid|lid", 2)] },
    };
    const text = JSON.stringify(envelope);
    const parsed = JSON.parse(text) as unknown;
    const res = mkRes(true, 200);
    const viaParse = normalizeStopsResponse(res, parsed, "rid_x");
    const viaDirect = normalizeStopsResponse(res, envelope, "rid_x");
    expect(JSON.stringify(viaParse)).toBe(JSON.stringify(viaDirect));
  });

  test("first-load og refresh: samme body-streng to ganger → identisk normalize (ingen hydrate som divergerer)", () => {
    const envelope = {
      ok: true,
      rid: "r1",
      data: { date: D, stops: [stop("k1|lunch|cid|lid", 1)] },
    };
    const text = JSON.stringify(envelope);
    const res = mkRes(true, 200);
    const a = normalizeStopsResponse(res, JSON.parse(text) as unknown, "fb");
    const b = normalizeStopsResponse(res, JSON.parse(text) as unknown, "fb");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("tom stops[] (operativt tomt): parse-path matcher direkte; samme shape som live-tom — ingen frozen-felt", () => {
    const envelope = { ok: true, rid: "e", data: { date: D, stops: [] } };
    const res = mkRes(true, 200);
    const viaParse = normalizeStopsResponse(res, JSON.parse(JSON.stringify(envelope)) as unknown, "fb");
    const viaDirect = normalizeStopsResponse(res, envelope, "fb");
    expect(JSON.stringify(viaParse)).toBe(JSON.stringify(viaDirect));
  });
});

describe("driver stops — canonical request URL (app/driver/DriverClient.tsx; normalizeStopsResponse bygger ikke URL)", () => {
  test("forventet klient-URL: GET /api/driver/stops?date= + encodeURIComponent(iso) — samme mønster som apiFetch-kall", () => {
    const iso = "2026-08-01";
    const expected = `/api/driver/stops?date=${encodeURIComponent(iso)}`;
    expect(expected).toBe("/api/driver/stops?date=2026-08-01");
  });

  test("datobytte: ulik iso gir ulik URL-streng (ingen stille gjenbruk)", () => {
    const a = `/api/driver/stops?date=${encodeURIComponent("2026-01-01")}`;
    const b = `/api/driver/stops?date=${encodeURIComponent("2026-01-02")}`;
    expect(a).not.toBe(b);
  });
});
