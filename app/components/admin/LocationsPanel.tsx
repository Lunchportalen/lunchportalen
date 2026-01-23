"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

/* =========================================================
   Types
========================================================= */
type LocationRow = {
  id: string;
  company_id?: string;

  name?: string | null;
  label?: string | null;

  address?: string | null;
  address_line1?: string | null;
  postal_code?: string | null;
  city?: string | null;

  delivery_contact_name?: string | null;
  delivery_contact_phone?: string | null;
  delivery_notes?: string | null;
  delivery_window_from?: string | null; // HH:MM
  delivery_window_to?: string | null; // HH:MM
};

type ApiList = {
  ok: boolean;
  locations: LocationRow[];
};

type AuditRow = {
  id: string;
  location_id: string;
  actor_email: string | null;
  action: string;
  created_at: string;
  diff?: any;
};

/* =========================================================
   Helpers
========================================================= */
function niceName(l: LocationRow) {
  return (l.label || l.name || "Lokasjon").trim();
}

function niceAddress(l: LocationRow) {
  const addr = (l.address || l.address_line1 || "").trim();
  const pc = (l.postal_code || "").trim();
  const city = (l.city || "").trim();
  const line2 = [pc, city].filter(Boolean).join(" ");
  return [addr, line2].filter(Boolean).join(", ");
}

function safeStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function fmtWhen(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString("nb-NO");
}

function downloadLocationsCsv() {
  const u = new URL("/api/admin/locations/export", window.location.origin);
  window.location.href = u.pathname + u.search;
}

/* =========================================================
   API helpers
========================================================= */
async function fetchLocations(): Promise<LocationRow[]> {
  const r = await fetch("/api/admin/locations", { cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as ApiList;
  if (!r.ok || !j?.ok) throw new Error("Kunne ikke hente lokasjoner");
  return j.locations ?? [];
}

async function updateLocation(payload: {
  id: string;
  delivery_contact_name?: string | null;
  delivery_contact_phone?: string | null;
  delivery_notes?: string | null;
  delivery_window_from?: string | null;
  delivery_window_to?: string | null;
}) {
  const r = await fetch("/api/admin/locations", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error("Kunne ikke oppdatere lokasjon");
}

async function fetchLatestAudit(locationId: string): Promise<AuditRow | null> {
  const u = new URL("/api/admin/locations/audit", window.location.origin);
  u.searchParams.set("location_id", locationId);
  const r = await fetch(u.pathname + u.search, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) return null;
  return j.latest ?? null;
}

async function fetchAuditList(locationId: string): Promise<AuditRow[]> {
  const u = new URL("/api/admin/locations/audit", window.location.origin);
  u.searchParams.set("location_id", locationId);
  u.searchParams.set("mode", "list");
  u.searchParams.set("limit", "10");
  const r = await fetch(u.pathname + u.search, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) return [];
  return j.items ?? [];
}

/* =========================================================
   Component
========================================================= */
export default function LocationsPanel() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const [latestAudit, setLatestAudit] = useState<Record<string, AuditRow | null>>({});
  const [auditList, setAuditList] = useState<AuditRow[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // editor fields
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [winFrom, setWinFrom] = useState("");
  const [winTo, setWinTo] = useState("");

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  function hydrateForm(loc: LocationRow | null) {
    setContactName(safeStr(loc?.delivery_contact_name));
    setContactPhone(safeStr(loc?.delivery_contact_phone));
    setNotes(safeStr(loc?.delivery_notes));
    setWinFrom(safeStr(loc?.delivery_window_from));
    setWinTo(safeStr(loc?.delivery_window_to));
  }

  function load() {
    startTransition(async () => {
      try {
        setErr(null);
        setOkMsg(null);

        const data = await fetchLocations();
        setRows(data);

        // preload latest audit for list
        const auditMap: Record<string, AuditRow | null> = {};
        for (const l of data) {
          auditMap[l.id] = await fetchLatestAudit(l.id);
        }
        setLatestAudit(auditMap);

        if (!selectedId && data.length) {
          const id = data[0].id;
          setSelectedId(id);
          hydrateForm(data[0]);
          setAuditList(await fetchAuditList(id));
        }
      } catch (e: any) {
        setErr(e?.message || "Feil ved henting");
      }
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSelect(id: string) {
    setSelectedId(id);
    setOkMsg(null);
    setErr(null);

    const loc = rows.find((r) => r.id === id) ?? null;
    hydrateForm(loc);

    startTransition(async () => {
      setAuditList(await fetchAuditList(id));
    });
  }

  function save() {
    if (!selectedId) return;

    startTransition(async () => {
      try {
        setErr(null);
        setOkMsg(null);

        await updateLocation({
          id: selectedId,
          delivery_contact_name: contactName.trim() || null,
          delivery_contact_phone: contactPhone.trim() || null,
          delivery_notes: notes.trim() || null,
          delivery_window_from: winFrom.trim() || null,
          delivery_window_to: winTo.trim() || null,
        });

        setOkMsg("Lagret.");
        await load();
      } catch (e: any) {
        setErr(e?.message || "Kunne ikke lagre");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Lokasjoner</h2>
          <p className="text-sm text-muted-foreground">
            Leveringskontakt og leveringsvindu per lokasjon. Ingen manuelle unntak.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={downloadLocationsCsv}
            className="h-9 rounded-md border px-3 text-sm hover:bg-muted"
          >
            Last ned CSV
          </button>
          <button
            onClick={load}
            disabled={isPending}
            className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            Oppdater
          </button>
          <button
            onClick={save}
            disabled={!selectedId || isPending}
            className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            Lagre
          </button>
        </div>
      </div>

      {err && <div className="rounded-md border bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {okMsg && <div className="rounded-md border bg-white p-3 text-sm">{okMsg}</div>}

      {/* Body */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* List */}
        <div className="rounded-2xl border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold">Lokasjoner</div>
          <div className="max-h-[360px] overflow-auto">
            <ul className="divide-y">
              {rows.map((l) => {
                const active = l.id === selectedId;
                const last = latestAudit[l.id];
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => onSelect(l.id)}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-muted ${
                        active ? "bg-muted" : ""
                      }`}
                    >
                      <div className="font-medium">{niceName(l)}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {niceAddress(l) || "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Sist lagret: {fmtWhen(last?.created_at)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Editor */}
        <div className="md:col-span-2 rounded-2xl border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold">Detaljer</div>

          {!selected ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">Velg en lokasjon.</div>
          ) : (
            <div className="space-y-4 px-4 py-4">
              <div>
                <div className="text-sm font-semibold">{niceName(selected)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {niceAddress(selected) || "—"}
                </div>
              </div>

              {/* Form */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Leveringskontakt</label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="h-9 w-full rounded-md border px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Telefon</label>
                  <input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="h-9 w-full rounded-md border px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Vindu fra</label>
                  <input
                    value={winFrom}
                    onChange={(e) => setWinFrom(e.target.value)}
                    className="h-9 w-full rounded-md border px-3 text-sm"
                    placeholder="HH:MM"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Vindu til</label>
                  <input
                    value={winTo}
                    onChange={(e) => setWinTo(e.target.value)}
                    className="h-9 w-full rounded-md border px-3 text-sm"
                    placeholder="HH:MM"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Notater</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[110px] w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              {/* Audit history */}
              <div className="rounded-md border bg-[rgb(var(--lp-surface))] p-3">
                <div className="text-xs font-semibold mb-2">Endringshistorikk</div>
                {auditList.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Ingen endringer registrert.</div>
                ) : (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {auditList.map((a) => (
                      <li key={a.id}>
                        {fmtWhen(a.created_at)}
                        {a.actor_email ? ` · ${a.actor_email}` : ""} · {a.action}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
