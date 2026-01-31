// app/driver/DriverClient.tsx
"use client";

import React, { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

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
    return new Date(iso).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
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
        "bg-white/70 hover:bg-white text-slate-900",
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
        "min-h-[48px] px-4 py-3 text-sm font-semibold",
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
        "min-h-[48px] px-4 py-3 text-sm font-semibold",
        "bg-white/70 text-slate-900 shadow-sm ring-1 ring-black/5",
        "hover:bg-white disabled:opacity-60",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default function DriverClient() {
  const [date, setDate] = useState<string>(todayISO());
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
    const text = [safeStr(s.companyName) || s.companyId, safeStr(s.locationName) || s.locationId, safeStr(s.addressLine)]
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
      <style>{`
        :root{
          --lp-safe-top: env(safe-area-inset-top);
          --lp-safe-bot: env(safe-area-inset-bottom);
        }
      `}</style>

      {/* Sticky Topbar */}
      <div
        className={["sticky top-0 z-40", "backdrop-blur-xl", "bg-white/60", "ring-1 ring-black/5"].join(" ")}
        style={{ paddingTop: "var(--lp-safe-top)" }}
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-semibold text-slate-900">Sjåfør</div>
              <div className="mt-1 text-sm text-slate-700">
                {fmtDateLong(shownDateSafe)} • <span className="font-semibold text-slate-900">{count}</span> stopp •{" "}
                <span className="font-semibold text-slate-900">{deliveredCount}</span> levert
              </div>
            </div>

            <div className="flex items-center gap-2">
              <IconBtn label="Verktøy" onClick={() => setToolsOpen(true)}>
                <span aria-hidden>⚙️</span>
              </IconBtn>

              <IconBtn label="Oppdater" onClick={() => load(shownDateSafe)} disabled={pending || loading}>
                <span aria-hidden>↻</span>
              </IconBtn>

              <IconBtn label="Logg ut" onClick={logout}>
                <span aria-hidden>⎋</span>
              </IconBtn>
            </div>
          </div>

          {/* Desktop controls */}
          <div className="hidden sm:flex items-center justify-between pb-3">
            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm ring-1 ring-black/5">
                <span className="text-slate-500" aria-hidden>
                  📅
                </span>
                <input
                  type="date"
                  value={shownDateSafe}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent outline-none"
                />
              </label>

              <SecondaryBtn
                label="Til i dag"
                onClick={() => {
                  setErr(null);
                  setLastApiErr(null);
                  setDate(todayISO());
                }}
                disabled={pending}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-black/5">
                <div className="text-xs text-slate-600">Leveringsprogress</div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="h-2 w-40 rounded-full bg-slate-900/10 overflow-hidden">
                    <div className="h-full bg-slate-900" style={{ width: `${deliveryProgress}%` }} />
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{deliveryProgress}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile compact date */}
          <div className="sm:hidden pb-3">
            <label className="inline-flex w-full items-center justify-between gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm ring-1 ring-black/5">
              <span className="inline-flex items-center gap-2">
                <span className="text-slate-500" aria-hidden>
                  📅
                </span>
                <span className="text-sm text-slate-700">Dato</span>
              </span>
              <input
                type="date"
                value={shownDateSafe}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-sm outline-none"
              />
            </label>
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
              <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm text-slate-800 ring-1 ring-black/5">
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
                      <b>Status:</b> {lastApiErr.status ?? "—"} &nbsp;•&nbsp; <b>RID:</b> {lastApiErr.rid ?? "—"}{" "}
                      &nbsp;•&nbsp; <b>Error:</b> {lastApiErr.error ?? "—"}
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

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PrimaryBtn label="Prøv igjen" onClick={() => load(shownDateSafe)} disabled={pending} />
              <SecondaryBtn
                label="Til i dag"
                onClick={() => {
                  setErr(null);
                  setLastApiErr(null);
                  setDate(todayISO());
                }}
                disabled={pending}
              />
            </div>
          </div>
        ) : null}

        {!loading && !err && count === 0 ? (
          <div className="mt-6 rounded-3xl bg-white/70 p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-base font-semibold text-slate-900">Ingen leveranser</div>
            <div className="mt-1 text-sm text-slate-600">Det er ingen stopp for valgt dato.</div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SecondaryBtn label="Til i dag" onClick={() => setDate(todayISO())} disabled={pending} />
              <PrimaryBtn label="Oppdater" onClick={() => load(shownDateSafe)} disabled={pending} />
            </div>
          </div>
        ) : null}

        {!loading && !err && count > 0 ? (
          <div className="mt-6 space-y-4">
            {stops.map((s) => {
              const title = `${safeStr(s.companyName) || s.companyId} • ${safeStr(s.locationName) || s.locationId}`;

              return (
                <div key={s.key} className="rounded-3xl bg-white/70 p-5 shadow-sm ring-1 ring-black/5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-slate-900">{title}</div>
                      <div className="mt-1 text-sm text-slate-600">{safeStr(s.addressLine) || "Adresse: —"}</div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-900/5 px-3 py-1 text-xs text-slate-800">
                          Slot: <b>{safeStr(s.slot) || "—"}</b>
                        </span>
                        <span className="rounded-full bg-slate-900/5 px-3 py-1 text-xs text-slate-800">
                          Antall: <b>{s.orderCount ?? 0}</b>
                        </span>

                        {s.delivered ? (
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-900">
                            ✅ Levert <b>{fmtTS(s.deliveredAt)}</b>
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-900">
                            ⏳ Ikke levert
                          </span>
                        )}
                      </div>

                      {s.deliveredBy ? (
                        <div className="mt-3 text-sm text-slate-700">
                          Levert av: <span className="font-semibold text-slate-900">{s.deliveredBy}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-[260px] sm:items-end">
                      <button
                        onClick={() => void confirmStop(s)}
                        disabled={pending || s.delivered}
                        className={[
                          "w-full rounded-2xl px-4 py-3 text-sm font-semibold",
                          s.delivered ? "bg-slate-900/10 text-slate-700" : "bg-slate-900 text-white hover:opacity-95",
                          "disabled:opacity-60",
                        ].join(" ")}
                        type="button"
                      >
                        {s.delivered ? "Levert" : "Markér levert"}
                      </button>

                      <button
                        onClick={() => void copyStop(s)}
                        className="w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-black/5 hover:bg-white"
                        type="button"
                      >
                        Kopiér stopp
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="sm:hidden fixed left-0 right-0 bottom-0 z-40" style={{ paddingBottom: "var(--lp-safe-bot)" }}>
        <div className="mx-auto w-full max-w-6xl px-4 pb-3">
          <div className="rounded-3xl bg-white/70 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-2">
              <SecondaryBtn
                label="Til i dag"
                onClick={() => {
                  setErr(null);
                  setLastApiErr(null);
                  setDate(todayISO());
                }}
                disabled={pending}
              />
              <SecondaryBtn label="Oppdater" onClick={() => load(shownDateSafe)} disabled={pending || loading} />
            </div>
          </div>
        </div>
      </div>

      {/* Tools Sheet */}
      {toolsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30"
          onClick={() => setToolsOpen(false)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute left-0 right-0 bottom-0 mx-auto w-full max-w-6xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "var(--lp-safe-bot)" }}
          >
            <div className="rounded-t-3xl bg-white/95 p-5 shadow-2xl ring-1 ring-black/10 backdrop-blur-xl">
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
                  <div className="h-2 w-full rounded-full bg-slate-900/10 overflow-hidden">
                    <div className="h-full bg-slate-900" style={{ width: `${deliveryProgress}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{deliveryProgress}% levert</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <SecondaryBtn
                  label="Til i dag"
                  onClick={() => {
                    setErr(null);
                    setLastApiErr(null);
                    setDate(todayISO());
                  }}
                  disabled={pending}
                />
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
