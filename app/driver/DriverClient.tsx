// app/driver/DriverClient.tsx
"use client";

import React, { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDateTimeNO } from "@/lib/date/format";

/* =========================================================
   Types
========================================================= */
type ApiErr = {
  ok: false;
  rid?: string;
  error?: string;
  message?: string;
  detail?: any;
  status?: number; // klient-side
};

type Stop = {
  key: string; // date|slot|companyId|locationId
  date: string; // YYYY-MM-DD
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

type StopsOk = { ok: true; rid?: string; date: string; stops: Stop[] };

// jsonOk-wrapper: { ok, rid, data }
type ApiWrapped<T> = {
  ok: boolean;
  rid?: string;
  data?: T;
  error?: string;
  message?: string;
  detail?: any;
};

type LocationGroup = {
  locationKey: string;
  locationName: string;
  addressLine: string;
  deliveryWhere: string;
  deliveryWhenNote: string;
  deliveryContact: string;
  deliveryWindow: string;
  orderCount: number;
  delivered: boolean;
  deliveredAt: string | null;
  deliveredBy: string | null;
  stop: Stop;
};

type CompanyGroup = {
  companyKey: string;
  companyName: string;
  locations: LocationGroup[];
  totalOrders: number;
};

type SlotGroup = {
  slotKey: string;
  slotLabel: string;
  companies: CompanyGroup[];
  totalOrders: number;
};

/* =========================================================
   Helpers
========================================================= */
function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""));
}

function fmtDateLong(iso: string) {
  try {
    const d = new Date(`${iso}T12:00:00+01:00`);
    return new Intl.DateTimeFormat("nb-NO", {
      timeZone: "Europe/Oslo",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

function fmtTS(iso?: string | null) {
  try {
    if (!iso) return "—";
    return formatDateTimeNO(iso);
  } catch {
    return "—";
  }
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function readJsonSafe(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function makeRid() {
  return `rid_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * ✅ FASIT: alltid send cookies/session til interne API-ruter
 */
async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      ...(init.headers ?? {}),
    },
  });
}

function prettyDetail(d: any) {
  if (!d) return null;
  if (typeof d === "string") return d;
  try {
    return JSON.stringify(d, null, 2);
  } catch {
    return String(d);
  }
}

function slotSortKey(slot: string) {
  const s = safeStr(slot).toLowerCase();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    return hh * 60 + mm;
  }
  return Number.MAX_SAFE_INTEGER;
}

function normalizedName(v: string) {
  return safeStr(v).toLowerCase();
}

function buildGroups(stops: Stop[]): SlotGroup[] {
  const slotMap = new Map<string, SlotGroup>();
  const slots: SlotGroup[] = [];

  for (const s of stops) {
    const slotLabel = safeStr(s.slot) || "Standard";
    let slot = slotMap.get(slotLabel);
    if (!slot) {
      slot = { slotKey: slotLabel, slotLabel, companies: [], totalOrders: 0 };
      slotMap.set(slotLabel, slot);
      slots.push(slot);
    }

    const companyName = safeStr(s.companyName) || s.companyId;
    let company = slot.companies.find((c) => c.companyKey === s.companyId);
    if (!company) {
      company = { companyKey: s.companyId, companyName, locations: [], totalOrders: 0 };
      slot.companies.push(company);
    }

    const locationName = safeStr(s.locationName) || s.locationId;
    const locationKey = `${s.companyId}:${s.locationId}`;
    const addressLine = safeStr(s.addressLine) || "Adresse: —";

    const deliveryWindow =
      safeStr(s.deliveryWindowFrom) && safeStr(s.deliveryWindowTo)
        ? `${safeStr(s.deliveryWindowFrom)}–${safeStr(s.deliveryWindowTo)}`
        : safeStr(s.deliveryWindowFrom) || safeStr(s.deliveryWindowTo) || "";

    const deliveryContact =
      safeStr(s.deliveryContactName) || safeStr(s.deliveryContactPhone)
        ? [safeStr(s.deliveryContactName), safeStr(s.deliveryContactPhone)].filter(Boolean).join(" • ")
        : "";

    const loc: LocationGroup = {
      locationKey,
      locationName,
      addressLine,
      deliveryWhere: safeStr(s.deliveryWhere),
      deliveryWhenNote: safeStr(s.deliveryWhenNote),
      deliveryContact,
      deliveryWindow,
      orderCount: Number(s.orderCount ?? 0) || 0,
      delivered: !!s.delivered,
      deliveredAt: s.deliveredAt ?? null,
      deliveredBy: s.deliveredBy ?? null,
      stop: s,
    };

    company.locations.push(loc);
    company.totalOrders += loc.orderCount;
    slot.totalOrders += loc.orderCount;
  }

  // deterministic ordering
  const ordered = slots
    .sort((a, b) => {
      const ka = slotSortKey(a.slotLabel);
      const kb = slotSortKey(b.slotLabel);
      if (ka !== kb) return ka - kb;
      return normalizedName(a.slotLabel).localeCompare(normalizedName(b.slotLabel), "nb");
    })
    .map((slot) => ({
      ...slot,
      companies: slot.companies
        .sort((a, b) => normalizedName(a.companyName).localeCompare(normalizedName(b.companyName), "nb"))
        .map((c) => ({
          ...c,
          locations: c.locations.sort((a, b) => {
            const aName = normalizedName(a.locationName);
            const bName = normalizedName(b.locationName);
            if (aName !== bName) return aName.localeCompare(bName, "nb");
            return normalizedName(a.addressLine).localeCompare(normalizedName(b.addressLine), "nb");
          }),
        })),
    }));

  return ordered;
}

/**
 * Normaliserer stops-responsen slik at UI alltid jobber med StopsOk
 * Støtter (robust):
 *  - Direkte: { ok:true, date, stops }
 *  - Wrapped A: { ok:true, rid, data:{ ok:true, date, stops } }
 *  - Wrapped B: { ok:true, rid, data:{ date, stops } }  (vanlig jsonOk-wrapper)
 */
type NormStops = { ok: true; data: StopsOk } | { ok: false; err: ApiErr };

function normalizeStopsResponse(res: Response, json: any, fallbackRid: string): NormStops {
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

  const ridAny = safeStr(json?.rid) || fallbackRid;

  function toStopsOk(x: any, rid: string): StopsOk | null {
    if (!x || typeof x !== "object") return null;
    if (typeof x.date === "string" && Array.isArray(x.stops)) {
      return { ok: true, rid, date: String(x.date), stops: x.stops as Stop[] };
    }
    return null;
  }

  // 1) Direkte payload
  if (json?.ok === true) {
    const direct = toStopsOk(json, safeStr(json?.rid) || ridAny);
    if (direct) return { ok: true, data: direct };
  }

  // 2) Wrapped payload i json.data
  if (json?.ok === true && json?.data) {
    const inner = json.data;
    const innerRid = ridAny;

    const mapped = toStopsOk(inner, innerRid);
    if (mapped) return { ok: true, data: mapped };

    const mapped2 = toStopsOk(inner?.data, innerRid);
    if (mapped2) return { ok: true, data: mapped2 };
  }

  // 3) Hvis API eksplisitt ok:false
  if (json?.ok === false) {
    return {
      ok: false,
      err: {
        ok: false,
        rid: ridAny,
        error: safeStr(json?.error) || `HTTP_${status}`,
        message: safeStr(json?.message) || safeStr(json?.error) || "API-feil.",
        detail: json?.detail ?? json ?? null,
        status,
      },
    };
  }

  // 4) Uventet struktur
  const msg =
    safeStr(json?.message) ||
    safeStr(json?.error) ||
    (res.ok ? "Mangler gyldig stops-data i respons." : `Kunne ikke hente stopp (HTTP ${status}).`);

  return {
    ok: false,
    err: {
      ok: false,
      rid: ridAny,
      error: safeStr(json?.error) || "bad_payload",
      message: msg,
      detail: json?.detail ?? json ?? null,
      status,
    },
  };
}

/* =========================
   UI primitives (calm)
========================= */
function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "inline-flex items-center justify-center rounded-full",
        "h-11 w-11 sm:h-10 sm:w-10",
        "bg-glass-medium hover:bg-white text-slate-900",
        "shadow-sm ring-1 ring-black/5",
        "disabled:opacity-60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center rounded-2xl",
        "min-h-12 px-4 py-3 text-sm font-semibold",
        "bg-slate-900 text-white shadow-sm",
        "hover:opacity-95 disabled:opacity-60",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function SecondaryBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center rounded-2xl",
        "min-h-12 px-4 py-3 text-sm font-semibold",
        "bg-glass-medium text-slate-900 shadow-sm ring-1 ring-black/5",
        "hover:bg-white disabled:opacity-60",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default function DriverClient() {
  const [date] = useState<string>(todayISO());
  const [data, setData] = useState<StopsOk | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [lastApiErr, setLastApiErr] = useState<ApiErr | null>(null);
  const [showTech, setShowTech] = useState(false);

  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const [toolsOpen, setToolsOpen] = useState(false);

  // ✅ Stabil stops-referanse uten "missing dependency: data"
  const stopsRaw = data?.stops;

  const stops = useMemo<Stop[]>(() => {
    return Array.isArray(stopsRaw) ? (stopsRaw as Stop[]) : [];
  }, [stopsRaw]);

  const count = useMemo(() => stops.length, [stops]);
  const deliveredCount = useMemo(() => stops.filter((s) => s.delivered).length, [stops]);

  const shownDate = data?.date ?? date;
  const shownDateSafe = isISODate(shownDate) ? shownDate : date;

  const groups = useMemo(() => buildGroups(stops), [stops]);

  async function load(nextDate: string) {
    const d = safeStr(nextDate) || todayISO();
    setLoading(true);
    setErr(null);
    setShowTech(false);

    try {
      const rid = makeRid();
      const res = await apiFetch(`/api/driver/stops?date=${encodeURIComponent(d)}`, {
        method: "GET",
        headers: { "x-rid": rid },
      });

      const json = await readJsonSafe(res);
      const norm = normalizeStopsResponse(res, json, rid);

      // 1) HTTP-feil
      if (!res.ok) {
        const apiErr: ApiErr = {
          ok: false,
          rid: safeStr(json?.rid) || rid,
          error: safeStr(json?.error) || `HTTP_${res.status}`,
          message: safeStr(json?.message) || safeStr(json?.error) || `Kunne ikke hente stopp (HTTP ${res.status}).`,
          detail: json?.detail ?? json ?? null,
          status: res.status,
        };
        setData(null);
        setLastApiErr(apiErr);
        setErr(apiErr.message ?? `Kunne ikke hente stopp (HTTP ${res.status}).`);
        return;
      }

      // 2) HTTP ok, men payload feil
      if (!("data" in norm)) {
        setData(null);
        setLastApiErr(norm.err);
        setErr(norm.err.message ?? "Kunne ikke hente stopp.");
        return;
      }

      // 3) OK
      setLastApiErr(null);
      setData(norm.data);
    } catch (e: any) {
      const apiErr: ApiErr = {
        ok: false,
        rid: undefined,
        error: "client_error",
        message: String(e?.message ?? e ?? "Ukjent feil"),
        detail: e?.stack ?? null,
        status: undefined,
      };
      setData(null);
      setLastApiErr(apiErr);
      setErr(apiErr.message ?? "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  async function confirmStop(s: Stop) {
    setErr(null);
    setShowTech(false);

    startTransition(async () => {
      try {
        const rid = makeRid();
        const res = await apiFetch("/api/driver/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-rid": rid },
          body: JSON.stringify({
            date: s.date,
            slot: s.slot,
            companyId: s.companyId,
            locationId: s.locationId,
          }),
        });

        const json = await readJsonSafe(res);
        const status = res.status;

        // 1) HTTP-feil
        if (!res.ok) {
          const apiErr: ApiErr = {
            ok: false,
            rid: safeStr(json?.rid) || rid,
            error: safeStr(json?.error) || `HTTP_${status}`,
            message: safeStr(json?.message) || safeStr(json?.error) || `Kunne ikke markere levert (HTTP ${status}).`,
            detail: json?.detail ?? json ?? null,
            status,
          };
          setLastApiErr(apiErr);
          setErr(apiErr.message ?? `Kunne ikke markere levert (HTTP ${status}).`);
          return;
        }

        // 2) HTTP ok – støtte både direkte og wrapped ok
        const directOk = json?.ok === true;
        const wrappedOk = json?.ok === true && json?.data?.ok === true;
        const wrappedOk2 = json?.ok === true && json?.data && typeof json.data === "object";

        if (!directOk && !wrappedOk && !wrappedOk2) {
          const apiErr: ApiErr = {
            ok: false,
            rid: safeStr(json?.rid) || rid,
            error: safeStr(json?.error) || "bad_payload",
            message: safeStr(json?.message) || safeStr(json?.error) || "Mangler gyldig confirm-respons.",
            detail: json?.detail ?? json ?? null,
            status,
          };
          setLastApiErr(apiErr);
          setErr(apiErr.message ?? "Mangler gyldig confirm-respons.");
          return;
        }

        // 3) OK
        setLastApiErr(null);
        await load(s.date);
      } catch (e: any) {
        const apiErr: ApiErr = {
          ok: false,
          rid: undefined,
          error: "client_error",
          message: String(e?.message ?? e ?? "Ukjent feil"),
          detail: e?.stack ?? null,
          status: undefined,
        };
        setLastApiErr(apiErr);
        setErr(apiErr.message ?? "Ukjent feil");
      }
    });
  }

  async function copyStop(s: Stop) {
    const deliveryWindow =
      safeStr(s.deliveryWindowFrom) && safeStr(s.deliveryWindowTo)
        ? `${safeStr(s.deliveryWindowFrom)}–${safeStr(s.deliveryWindowTo)}`
        : safeStr(s.deliveryWindowFrom) || safeStr(s.deliveryWindowTo) || "";
    const text = [
      safeStr(s.companyName) || s.companyId,
      safeStr(s.locationName) || s.locationId,
      safeStr(s.addressLine),
      safeStr(s.deliveryWhere),
      safeStr(s.deliveryWhenNote),
      deliveryWindow,
    ]
      .filter(Boolean)
      .join(" – ");
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // no-op
    }
  }

  async function copyApiError() {
    if (!lastApiErr) return;
    const payload = {
      status: lastApiErr.status ?? null,
      rid: lastApiErr.rid ?? null,
      error: lastApiErr.error ?? null,
      message: lastApiErr.message ?? null,
      detail: lastApiErr.detail ?? null,
    };
    try {
      await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    } catch {
      // no-op
    }
  }

  async function logout() {
    const ok = window.confirm("Vil du logge ut av Lunchportalen?");
    if (!ok) return;

    try {
      const sb = supabaseBrowser();
      await sb.auth.signOut();
    } catch {
      // no-op
    } finally {
      window.location.replace("/login");
    }
  }

  useEffect(() => {
    void load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // ESC lukker sheet
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setToolsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const deliveryProgress = count <= 0 ? 0 : Math.round((deliveredCount / Math.max(1, count)) * 100);
  const techDetail = lastApiErr ? prettyDetail(lastApiErr.detail) : null;

  return (
    <div
      className={[
        "relative",
        "min-h-[calc(100svh)]",
        "bg-[radial-gradient(1200px_600px_at_50%_0%,rgba(15,23,42,0.06),transparent_70%)]",
      ].join(" ")}
    >
      {/* Sticky Topbar */}
      <div className="sticky top-0 z-40 lp-safe-top lp-glass-bar">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-semibold text-slate-900">Dagens leveringer</div>
              <div className="mt-1 text-sm text-slate-700">
                {fmtDateLong(shownDateSafe)} • <span className="font-semibold text-slate-900">{count}</span> stopp •{" "}
                <span className="font-semibold text-slate-900">{deliveredCount}</span> levert
              </div>
              <div className="mt-1 text-xs text-slate-600">ACTIVE / READY FOR DELIVERY</div>
            </div>

            <div className="flex items-center gap-2">
              <IconBtn label="Verktøy" onClick={() => setToolsOpen(true)}>
                <Icon name="settings" size="md" />
              </IconBtn>

              <IconBtn label="Oppdater" onClick={() => load(shownDateSafe)} disabled={pending || loading}>
                <Icon name="refresh" size="md" />
              </IconBtn>

              <IconBtn label="Logg ut" onClick={logout}>
                <Icon name="logout" size="md" />
              </IconBtn>
            </div>
          </div>

          <div className="hidden sm:flex items-center justify-end pb-3">
            <div className="lp-glass-surface rounded-card px-4 py-3">
              <div className="text-xs text-slate-600">Leveringsprogress</div>
              <div className="mt-1 flex items-center gap-3">
                <progress className="lp-progress w-40" value={deliveryProgress} max={100} />
                <div className="text-sm font-semibold text-slate-900">{deliveryProgress}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-24 sm:pb-8">
        {loading ? <div className="mt-6 text-sm text-slate-600">Laster…</div> : null}

        {!loading && err ? (
          <div className="mt-6 rounded-3xl bg-red-500/10 p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-base font-semibold text-red-900">Feil</div>
            <div className="mt-1 text-sm text-red-900">{err}</div>

            {lastApiErr ? (
              <div className="lp-glass-surface mt-4 rounded-card p-4 text-sm text-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTech((v) => !v)}
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                  >
                    {showTech ? "Skjul teknisk" : "Vis teknisk"}
                  </button>

                  <button
                    type="button"
                    onClick={copyApiError}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-black/5 hover:bg-white"
                  >
                    Kopiér feilmelding
                  </button>
                </div>

                {showTech ? (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-slate-600">
                      <b>Status:</b> {lastApiErr.status ?? "—"} &nbsp;•&nbsp; <b>RID:</b> {lastApiErr.rid ?? "—"} &nbsp;•&nbsp;{" "}
                      <b>Error:</b> {lastApiErr.error ?? "—"}
                    </div>

                    {techDetail ? (
                      <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
                        {techDetail}
                      </pre>
                    ) : (
                      <div className="text-xs text-slate-600">Ingen detail i respons.</div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5">
              <PrimaryBtn label="Prøv igjen" onClick={() => load(shownDateSafe)} disabled={pending} />
            </div>
          </div>
        ) : null}

        {!loading && !err && count === 0 ? (
          <div className="lp-glass-card mt-6 rounded-card p-6">
            <div className="text-base font-semibold text-slate-900">Ingen leveranser</div>
            <div className="mt-1 text-sm text-slate-600">Det er ingen stopp for valgt dato.</div>

            <div className="mt-5">
              <PrimaryBtn label="Oppdater" onClick={() => load(shownDateSafe)} disabled={pending} />
            </div>
          </div>
        ) : null}

        {!loading && !err && count > 0 ? (
          <div className="mt-6 space-y-5">
            {groups.map((slot) => (
              <section key={slot.slotKey} className="lp-glass-card rounded-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-base font-semibold text-slate-900">Leveringsvindu: {slot.slotLabel}</div>
                  <div className="text-sm text-slate-700">
                    Totalt: <b>{slot.totalOrders}</b>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {slot.companies.map((c) => (
                    <div key={c.companyKey} className="rounded-2xl border border-black/5 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-base font-semibold text-slate-900">{c.companyName}</div>
                        <div className="text-sm text-slate-700">
                          Totalt firma: <b>{c.totalOrders}</b>
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        {c.locations.map((l) => (
                          <div key={l.locationKey} className="rounded-2xl bg-[rgb(var(--lp-surface-2))] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-900">{l.locationName}</div>
                              <div className="text-sm text-slate-700">
                                Totalt lokasjon: <b>{l.orderCount}</b>
                              </div>
                            </div>

                            <div className="mt-2 text-sm text-slate-700 lp-wrap-anywhere">{l.addressLine}</div>

                            <div className="mt-2 grid gap-1 text-xs text-slate-700">
                              {l.deliveryWindow ? <div>Tidsvindu: {l.deliveryWindow}</div> : null}
                              {l.deliveryWhere ? <div>Levering: {l.deliveryWhere}</div> : null}
                              {l.deliveryWhenNote ? <div>Notater: {l.deliveryWhenNote}</div> : null}
                              {l.deliveryContact ? <div>Kontakt: {l.deliveryContact}</div> : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-slate-900/5 px-3 py-1 text-slate-800">
                                Innhold: <b>{l.orderCount}</b> ordre
                              </span>
                              {l.delivered ? (
                                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-900">
                                  Levert <b>{fmtTS(l.deliveredAt)}</b>
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-900">
                                  Ikke levert
                                </span>
                              )}
                            </div>

                            {l.deliveredBy ? (
                              <div className="mt-2 text-sm text-slate-700">
                                Levert av: <span className="font-semibold text-slate-900">{l.deliveredBy}</span>
                              </div>
                            ) : null}

                            <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                              <button
                                onClick={() => void confirmStop(l.stop)}
                                disabled={pending || l.delivered}
                                className={[
                                  "w-full sm:w-auto rounded-2xl px-4 py-3 text-sm font-semibold",
                                  l.delivered ? "bg-slate-900/10 text-slate-700" : "bg-slate-900 text-white hover:opacity-95",
                                  "disabled:opacity-60",
                                ].join(" ")}
                                type="button"
                              >
                                {l.delivered ? "Levert" : "Markér levert"}
                              </button>

                              <button
                                onClick={() => void copyStop(l.stop)}
                                className="w-full sm:w-auto rounded-2xl bg-glass-medium px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-black/5 hover:bg-white"
                                type="button"
                              >
                                Kopiér stopp
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="sm:hidden fixed left-0 right-0 bottom-0 z-40 lp-safe-bottom">
        <div className="mx-auto w-full max-w-6xl px-4 pb-3">
          <div className="lp-glass-surface rounded-card p-3">
            <div>
              <SecondaryBtn label="Oppdater" onClick={() => load(shownDateSafe)} disabled={pending || loading} />
            </div>
          </div>
        </div>
      </div>

      {/* Tools Sheet */}
      {toolsOpen && (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
            <div
              className="lp-motion-overlay lp-glass-overlay absolute inset-0"
              role="button"
              tabIndex={-1}
              aria-label="Lukk verktøy"
              onClick={() => setToolsOpen(false)}
              onKeyDown={(e) => e.key === "Escape" && setToolsOpen(false)}
            />
          <div className="absolute left-0 right-0 bottom-0 mx-auto w-full max-w-6xl lp-safe-bottom">
            <div className="lp-glass-panel rounded-t-3xl p-5">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">Verktøy</div>
                <button
                  type="button"
                  onClick={() => setToolsOpen(false)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  Lukk
                </button>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-900/5 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">Oppsummering</div>
                <div className="mt-2 text-sm text-slate-700">
                  {fmtDateLong(shownDateSafe)} • <b>{count}</b> stopp • <b>{deliveredCount}</b> levert
                </div>

                <div className="mt-3">
                  <progress className="lp-progress w-full" value={deliveryProgress} max={100} />
                  <div className="mt-1 text-xs text-slate-600">{deliveryProgress}% levert</div>
                </div>
              </div>

              <div className="mt-4">
                <SecondaryBtn label="Oppdater" onClick={() => load(shownDateSafe)} disabled={pending || loading} />
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                >
                  Logg ut
                </button>
              </div>

              <div className="mt-3 text-xs text-slate-500">Tips: Trykk ESC for å lukke.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
