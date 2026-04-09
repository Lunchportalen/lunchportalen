/**
 * Normaliserer GET /api/driver/stops-respons slik at UI alltid får strukturert payload.
 * Støtter jsonOk-konvolutt og eldre flate varianter.
 */

export type ApiErr = {
  ok: false;
  rid?: string;
  error?: string;
  message?: string;
  detail?: unknown;
  status?: number;
};

export type Stop = {
  key: string;
  date: string;
  slot: string;
  companyId: string;
  companyName: string | null;
  locationId: string;
  locationName: string | null;
  addressLine: string | null;
  deliveryWhere: string | null;
  deliveryWhenNote: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  deliveryWindowFrom: string | null;
  deliveryWindowTo: string | null;
  orderCount: number;
  delivered: boolean;
  deliveredAt: string | null;
  deliveredBy: string | null;
};

export type StopsOk = { ok: true; rid?: string; date: string; stops: Stop[] };

export type NormStops = { ok: true; data: StopsOk } | { ok: false; err: ApiErr };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export function normalizeStopsResponse(res: Response, json: unknown, fallbackRid: string): NormStops {
  const status = res.status;

  if (!json) {
    return {
      ok: false,
      err: {
        ok: false,
        rid: fallbackRid,
        error: `HTTP_${status}`,
        message: `Kunne ikke hente stopp (HTTP ${status}).`,
        detail: null,
        status,
      },
    };
  }

  const ridAny = safeStr((json as { rid?: unknown })?.rid) || fallbackRid;

  function toStopsOk(x: unknown, rid: string): StopsOk | null {
    if (!x || typeof x !== "object") return null;
    const o = x as { date?: unknown; stops?: unknown };
    if (typeof o.date === "string" && Array.isArray(o.stops)) {
      return { ok: true, rid, date: String(o.date), stops: o.stops as Stop[] };
    }
    return null;
  }

  const j = json as Record<string, unknown>;

  if (j?.ok === true) {
    const direct = toStopsOk(json, safeStr(j?.rid) || ridAny);
    if (direct) return { ok: true, data: direct };
  }

  if (j?.ok === true && j?.data) {
    const inner = j.data as Record<string, unknown>;
    const innerRid = ridAny;

    const mapped = toStopsOk(inner, innerRid);
    if (mapped) return { ok: true, data: mapped };

    const innerData = inner?.data;
    const mapped2 = toStopsOk(innerData, innerRid);
    if (mapped2) return { ok: true, data: mapped2 };
  }

  if (j?.ok === false) {
    return {
      ok: false,
      err: {
        ok: false,
        rid: ridAny,
        error: safeStr(j?.error) || `HTTP_${status}`,
        message: safeStr(j?.message) || safeStr(j?.error) || "API-feil.",
        detail: j?.detail ?? json ?? null,
        status,
      },
    };
  }

  const msg =
    safeStr(j?.message) ||
    safeStr(j?.error) ||
    (res.ok ? "Mangler gyldig stops-data i respons." : `Kunne ikke hente stopp (HTTP ${status}).`);

  return {
    ok: false,
    err: {
      ok: false,
      rid: ridAny,
      error: safeStr(j?.error) || "bad_payload",
      message: msg,
      detail: j?.detail ?? json ?? null,
      status,
    },
  };
}
