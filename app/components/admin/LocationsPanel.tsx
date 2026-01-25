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
};

type ApiOk = { ok: true; locations: LocationRow[] };
type ApiErr = { ok: false; error: string; message?: string; detail?: any };

export default function LocationsPanel({ companyId, readOnly = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

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
      setRows((json as ApiOk).locations ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente lokasjoner.");
      setRows([]);
    } finally {
      setLoading(false);
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
              {rows.map((loc) => (
                <div key={loc.id} className="rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
                  <div className="text-sm font-semibold">{loc.name ?? "Lokasjon"}</div>
                  <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
                    ID: <span className="font-mono">{loc.id}</span>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-[rgb(var(--lp-muted))]">
                    <div>Leveringskontakt: <span className="font-medium text-[rgb(var(--lp-text))]">{loc.contact_name ?? "—"}</span></div>
                    <div>Telefon: <span className="font-medium text-[rgb(var(--lp-text))]">{loc.contact_phone ?? "—"}</span></div>
                    <div>Vindu: <span className="font-medium text-[rgb(var(--lp-text))]">{loc.window_from ?? "—"}</span> –{" "}
                      <span className="font-medium text-[rgb(var(--lp-text))]">{loc.window_to ?? "—"}</span>
                    </div>
                    {loc.notes ? (
                      <div className="text-xs text-[rgb(var(--lp-muted))]">Notat: {loc.notes}</div>
                    ) : null}
                  </div>
                </div>
              ))}
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
