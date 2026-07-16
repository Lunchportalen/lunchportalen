"use client";

import { useEffect, useState } from "react";

import { locationStatusLabel } from "@/lib/admin/companyAdminCopy";

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
  delivery_instructions?: string | null;
};

type EditState = {
  contact_name: string;
  contact_phone: string;
  window_from: string;
  window_to: string;
  delivery_instructions: string;
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
  const [busyId, setBusyId] = useState<string | null>(null);

  // Fase 5: opprett nytt leveringssted + rediger leveringsdetaljer.
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [newLoc, setNewLoc] = useState({ name: "", address: "", contact_name: "", contact_phone: "", window_from: "", window_to: "", delivery_instructions: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ contact_name: "", contact_phone: "", window_from: "", window_to: "", delivery_instructions: "" });
  const [editBusy, setEditBusy] = useState(false);

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

  async function createLocation() {
    if (readOnly || createBusy) return;
    setActionErr(null);
    setCreateBusy(true);
    try {
      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLoc),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        setActionErr(String(json?.message ?? "Kunne ikke opprette leveringssted."));
        return;
      }
      setCreating(false);
      setNewLoc({ name: "", address: "", contact_name: "", contact_phone: "", window_from: "", window_to: "", delivery_instructions: "" });
      await load();
    } catch {
      setActionErr("Uventet feil ved oppretting.");
    } finally {
      setCreateBusy(false);
    }
  }

  function startEdit(loc: LocationRow) {
    setEditId(loc.id);
    setEdit({
      contact_name: safeStr(loc.contact_name),
      contact_phone: safeStr(loc.contact_phone),
      window_from: safeStr(loc.window_from),
      window_to: safeStr(loc.window_to),
      delivery_instructions: safeStr(loc.delivery_instructions),
    });
  }

  async function saveEdit(locationId: string) {
    if (readOnly || editBusy) return;
    setActionErr(null);
    setEditBusy(true);
    try {
      const res = await fetch("/api/admin/locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, ...edit }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        setActionErr(String(json?.message ?? "Kunne ikke lagre leveringsdetaljer."));
        return;
      }
      setEditId(null);
      await load();
    } catch {
      setActionErr("Uventet feil ved lagring.");
    } finally {
      setEditBusy(false);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const editFieldClass = "mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm";

  return (
    <section>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-semibold">Lokasjoner</div>
          <div className="text-sm text-[rgb(var(--lp-muted))]">
            Leveringskontakt og leveringsvindu per sted. Ansatte velger lokasjon ved registrering.
          </div>
          {readOnly ? (
            <div className="mt-2 inline-flex rounded-2xl bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]">
              Låst: Admin kan se disse opplysningene, men kun Superadmin kan redigere.
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          {!readOnly ? (
            <button
              onClick={() => setCreating((v) => !v)}
              className="rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {creating ? "Avbryt" : "Nytt leveringssted"}
            </button>
          ) : null}
          <button
            onClick={load}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))]"
          >
            Oppdater
          </button>
        </div>
      </div>

      {creating && !readOnly ? (
        <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Nytt leveringssted</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium">
              Navn *
              <input className={editFieldClass} name="new_loc_name" value={newLoc.name} onChange={(e) => setNewLoc((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label className="text-xs font-medium">
              Adresse *
              <input className={editFieldClass} name="new_loc_address" value={newLoc.address} onChange={(e) => setNewLoc((p) => ({ ...p, address: e.target.value }))} />
            </label>
            <label className="text-xs font-medium">
              Leveringskontakt
              <input className={editFieldClass} value={newLoc.contact_name} onChange={(e) => setNewLoc((p) => ({ ...p, contact_name: e.target.value }))} />
            </label>
            <label className="text-xs font-medium">
              Telefon
              <input className={editFieldClass} value={newLoc.contact_phone} onChange={(e) => setNewLoc((p) => ({ ...p, contact_phone: e.target.value }))} />
            </label>
            <label className="text-xs font-medium">
              Vindu fra (HH:MM)
              <input className={editFieldClass} placeholder="11:00" value={newLoc.window_from} onChange={(e) => setNewLoc((p) => ({ ...p, window_from: e.target.value }))} />
            </label>
            <label className="text-xs font-medium">
              Vindu til (HH:MM)
              <input className={editFieldClass} placeholder="13:00" value={newLoc.window_to} onChange={(e) => setNewLoc((p) => ({ ...p, window_to: e.target.value }))} />
            </label>
            <label className="text-xs font-medium md:col-span-2">
              Leveringsinstruksjoner
              <textarea className={editFieldClass} rows={2} placeholder="F.eks. ringeklokke, etasje, varemottak" value={newLoc.delivery_instructions} onChange={(e) => setNewLoc((p) => ({ ...p, delivery_instructions: e.target.value }))} />
            </label>
          </div>
          <button
            onClick={createLocation}
            disabled={createBusy}
            className="mt-3 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {createBusy ? "Oppretter …" : "Opprett leveringssted"}
          </button>
        </div>
      ) : null}

      {actionErr ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {actionErr}
        </div>
      ) : null}

      <div className="mt-4 rounded-3xl ring-1 ring-[rgb(var(--lp-border))]">
        <div className="bg-white p-4">
          {loading ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
          ) : err ? (
            <div className="text-sm text-red-600">{err}</div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 text-sm text-[rgb(var(--lp-muted))]">
              <div className="text-base font-semibold text-[rgb(var(--lp-text))]">Ingen leveringssteder registrert</div>
              <p className="mt-2">Kontakt Lunchportalen hvis dere mangler et leveringssted.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((loc) => {
                const status = normalizeStatus(loc.status);
                return (
                  <div key={loc.id} className="rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{loc.name ?? "Lokasjon"}</div>
                        {loc.address ? (
                          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{loc.address}</div>
                        ) : null}
                      </div>
                      <span className={["rounded-full px-3 py-1 text-xs font-semibold ring-1", statusTone(status)].join(" ")}>
                        {locationStatusLabel(status)}
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
                        Leveringsvindu: <span className="font-medium text-[rgb(var(--lp-text))]">{loc.window_from ?? "—"}</span> –{" "}
                        <span className="font-medium text-[rgb(var(--lp-text))]">{loc.window_to ?? "—"}</span>
                      </div>
                      <div className="text-xs text-[rgb(var(--lp-muted))]">
                        Ansatte knyttet til dette stedet bestiller lunsj hit.
                      </div>
                      {loc.notes ? (
                        <div className="text-xs text-[rgb(var(--lp-muted))]">Notat: {loc.notes}</div>
                      ) : null}
                      {loc.delivery_instructions ? (
                        <div className="text-xs text-[rgb(var(--lp-muted))]">
                          Leveringsinstruksjoner: <span className="text-[rgb(var(--lp-text))]">{loc.delivery_instructions}</span>
                        </div>
                      ) : null}
                    </div>

                    {editId === loc.id && !readOnly ? (
                      <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
                        <div className="grid gap-2 md:grid-cols-2">
                          <label className="text-xs font-medium">
                            Leveringskontakt
                            <input className={editFieldClass} value={edit.contact_name} onChange={(e) => setEdit((p) => ({ ...p, contact_name: e.target.value }))} />
                          </label>
                          <label className="text-xs font-medium">
                            Telefon
                            <input className={editFieldClass} value={edit.contact_phone} onChange={(e) => setEdit((p) => ({ ...p, contact_phone: e.target.value }))} />
                          </label>
                          <label className="text-xs font-medium">
                            Vindu fra (HH:MM)
                            <input className={editFieldClass} value={edit.window_from} onChange={(e) => setEdit((p) => ({ ...p, window_from: e.target.value }))} />
                          </label>
                          <label className="text-xs font-medium">
                            Vindu til (HH:MM)
                            <input className={editFieldClass} value={edit.window_to} onChange={(e) => setEdit((p) => ({ ...p, window_to: e.target.value }))} />
                          </label>
                          <label className="text-xs font-medium md:col-span-2">
                            Leveringsinstruksjoner
                            <textarea className={editFieldClass} rows={2} value={edit.delivery_instructions} onChange={(e) => setEdit((p) => ({ ...p, delivery_instructions: e.target.value }))} />
                          </label>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => saveEdit(loc.id)} disabled={editBusy} className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
                            {editBusy ? "Lagrer …" : "Lagre"}
                          </button>
                          <button onClick={() => setEditId(null)} className="rounded-full border px-3 py-1 text-xs font-semibold">
                            Avbryt
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-[rgb(var(--lp-muted))]">Vis teknisk info</summary>
                      <div className="mt-2 font-mono text-[11px] text-[rgb(var(--lp-muted))]">location_id: {loc.id}</div>
                    </details>

                    {!readOnly ? (
                      <div className="mt-4 flex gap-2">
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
                        <button
                          onClick={() => (editId === loc.id ? setEditId(null) : startEdit(loc))}
                          className="rounded-full border px-3 py-1 text-xs font-semibold text-neutral-900 hover:bg-white"
                        >
                          {editId === loc.id ? "Lukk" : "Rediger levering"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-[rgb(var(--lp-muted))]">Vis teknisk info</summary>
            <div className="mt-2 font-mono text-[11px] text-[rgb(var(--lp-muted))]">company_id: {companyId}</div>
          </details>
        </div>
      </div>
    </section>
  );
}
