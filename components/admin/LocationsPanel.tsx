// components/admin/LocationsPanel.tsx
"use client";

import { useEffect, useState } from "react";

type Props = {
  companyId: string;
  readOnly?: boolean;
};

type LocationRow = {
  id: string;
  name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  window_from: string | null;
  window_to: string | null;
  notes: string | null;
  status?: string | null;
  address?: string | null;
  slot_policy?: string | null;
};

type ApiOk = { ok: true; rid?: string; data?: { locations?: LocationRow[] } | null; locations?: LocationRow[] };
type ApiErr = { ok: false; rid?: string; error: string; message?: string; detail?: any };

type StatusOk = { ok: true; rid?: string; data?: { location?: { id: string; status: string | null } } };

type StatusResp = StatusOk | ApiErr;

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeStatus(v: any) {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE" || s === "INACTIVE") return s;
  return s || "UNKNOWN";
}

function statusTone(s: string) {
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (s === "INACTIVE") return "bg-rose-50 text-rose-900 ring-rose-200";
  return "bg-neutral-100 text-neutral-800 ring-neutral-200";
}

export default function LocationsPanel({ companyId, readOnly = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actionRid, setActionRid] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/locations?companyId=${encodeURIComponent(companyId)}`, {
        method: "GET",
        headers: { "cache-control": "no-store" },
      });
      const json = (await res.json()) as ApiOk | ApiErr;
      if (!res.ok || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }
      const payload = (json as any).data ?? json;
      const locations = Array.isArray(payload?.locations) ? payload.locations : [];
      setRows(locations ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente lokasjoner.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(loc: LocationRow) {
    if (readOnly) return;
    setActionErr(null);
    setActionRid(null);
    setBusyId(loc.id);

    const nextStatus = normalizeStatus(loc.status) === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      const res = await fetch("/api/admin/locations/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: loc.id, status: nextStatus }),
      });
      const json = (await res.json().catch(() => null)) as StatusResp | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr | null;
        setActionErr(j?.message || j?.error || `HTTP ${res.status}`);
        setActionRid(j?.rid ?? null);
        return;
      }

      setRows((prev) =>
        prev.map((row) => (row.id === loc.id ? { ...row, status: nextStatus } : row))
      );
    } catch (e: any) {
      setActionErr(e?.message ?? "Kunne ikke oppdatere lokasjon.");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <section>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-semibold">Lokasjoner</div>
          <div className="text-sm text-[rgb(var(--lp-muted))]">
            Leveringskontakt og leveringsvindu per lokasjon. Ingen manuelle unntak.
          </div>
          {readOnly ? (
            <div className="mt-2 inline-flex rounded-2xl bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]">
              Låst: Admin kan se disse opplysningene, men kun Superadmin kan redigere.
            </div>
          ) : null}
        </div>

        <button
          onClick={load}
          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))]"
        >
          Oppdater
        </button>
      </div>

      {actionErr ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {actionErr}
          {actionRid ? <div className="mt-1 text-xs font-mono">RID: {actionRid}</div> : null}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-3xl ring-1 ring-[rgb(var(--lp-border))]">
        <div className="bg-white p-4">
          {loading ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
          ) : err ? (
            <div className="text-sm text-red-600">{err}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen lokasjoner funnet.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((loc) => {
                const status = normalizeStatus(loc.status);
                return (
                  <div key={loc.id} className="rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{loc.name ?? "Lokasjon"}</div>
                        <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
                          ID: <span className="font-mono">{loc.id}</span>
                        </div>
                      </div>
                      <span className={["rounded-full px-3 py-1 text-xs font-semibold ring-1", statusTone(status)].join(" ")}>
                        {status}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-[rgb(var(--lp-muted))]">
                      <div>
                        Leveringskontakt: <span className="font-medium text-[rgb(var(--lp-text))]">{loc.contact_name ?? "—"}</span>
                      </div>
                      <div>
                        Telefon: <span className="font-medium text-[rgb(var(--lp-text))]">{loc.contact_phone ?? "—"}</span>
                      </div>
                      <div>
                        Vindu: <span className="font-medium text-[rgb(var(--lp-text))]">{loc.window_from ?? "—"}</span> –{" "}
                        <span className="font-medium text-[rgb(var(--lp-text))]">{loc.window_to ?? "—"}</span>
                      </div>
                      {loc.address ? (
                        <div className="text-xs text-[rgb(var(--lp-muted))]">Adresse: {loc.address}</div>
                      ) : null}
                      {loc.notes ? (
                        <div className="text-xs text-[rgb(var(--lp-muted))]">Notat: {loc.notes}</div>
                      ) : null}
                    </div>

                    {!readOnly ? (
                      <div className="mt-4">
                        <button
                          onClick={() => toggleStatus(loc)}
                          disabled={busyId === loc.id}
                          className="rounded-full border px-3 py-1 text-xs font-semibold text-neutral-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyId === loc.id
                            ? "Oppdaterer…"
                            : status === "ACTIVE"
                              ? "Deaktiver"
                              : "Aktiver"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
            Firma-ID: <span className="font-mono">{companyId}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
