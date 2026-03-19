// components/superadmin/FirmEmployeesClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeNO } from "@/lib/date/format";

type Row = {
  user_id: string;
  email: string | null;
  name: string | null;
  department: string | null;
  location_id: string | null;
  role: string | null;
  is_active: boolean;
  disabled_at: string | null;
  deleted_at: string | null;
  last_active_at: string | null;
  created_at: string | null;
};

type ApiOk = { ok: true; employees: Row[]; total: number; page: number; limit: number };
type ApiErr = { ok: false; error: string; message?: string; detail?: any };

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) throw new Error(`Tom respons (HTTP ${res.status})`);
  return JSON.parse(t);
}

function fmt(ts?: string | null) {
  if (!ts) return "—";
  return formatDateTimeNO(ts);
}

function statusLabel(r: Row) {
  if (r.deleted_at) return "Slettet";
  if (r.disabled_at || r.is_active === false) return "Deaktivert";
  return "Aktiv";
}

function roleLabel(role: string | null) {
  const s = String(role ?? "").toLowerCase();
  if (s === "employee") return "Ansatt";
  if (s === "company_admin") return "Firma-admin";
  if (s === "superadmin") return "Superadmin";
  if (s === "driver") return "Sjåfør";
  if (s === "kitchen") return "Kjøkken";
  return "—";
}

export default function FirmEmployeesClient({ companyId }: { companyId: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    user_id: string;
    name: string | null;
    email: string | null;
  } | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const url =
        `/api/superadmin/firms/${encodeURIComponent(companyId)}/employees` +
        `?q=${encodeURIComponent(q.trim())}&page=${page}&limit=${limit}`;

      const res = await fetch(url, { headers: { "cache-control": "no-store" } });
      const json = (await readJson(res)) as ApiOk | ApiErr;
      if (!res.ok || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j.message || j.error || `HTTP ${res.status}`);
      }
      const ok = json as ApiOk;
      setRows(ok.employees);
      setTotal(ok.total);
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente ansatte.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, page]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  async function deactivateUser(user_id: string) {
    setBusyId(user_id);
    setErr(null);

    try {
      const res = await fetch(`/api/superadmin/employees/${encodeURIComponent(user_id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId }),
      });

      const json = (await readJson(res)) as { ok: true } | ApiErr;
      if (!res.ok || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j.message || j.error || `HTTP ${res.status}`);
      }

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke deaktivere bruker.");
    } finally {
      setBusyId(null);
    }
  }

  async function softDeleteUser(user_id: string) {
    setBusyId(user_id);
    setErr(null);

    try {
      const res = await fetch(
        `/api/superadmin/employees/${encodeURIComponent(user_id)}?companyId=${encodeURIComponent(companyId)}`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ companyId }),
        }
      );

      const json = (await readJson(res)) as { ok: true } | ApiErr;
      if (!res.ok || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j.message || j.error || `HTTP ${res.status}`);
      }

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke slette bruker.");
    } finally {
      setBusyId(null);
      setConfirmState(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold">Ansatte</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Full oversikt per firma. Bruk søk ved behov.</div>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk e-post/navn/avdeling"
            className="w-80 max-w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
          />
          <button
            onClick={() => {
              setPage(1);
              load();
            }}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))]"
          >
            Søk
          </button>
        </div>
      </div>

      {err ? <div className="mt-4 text-sm text-red-600">{err}</div> : null}

      <div className="mt-4 overflow-hidden rounded-3xl ring-1 ring-[rgb(var(--lp-border))]">
        <div className="bg-white p-4">
          {loading ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Laster...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen ansatte funnet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-[rgb(var(--lp-muted))]">
                  <tr className="[&>th]:py-2 [&>th]:pr-3">
                    <th>Navn</th>
                    <th>Rolle</th>
                    <th>Status</th>
                    <th>Siste aktivitet</th>
                    <th className="text-right">Handlinger</th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-t [&>tr]:border-[rgb(var(--lp-border))]">
                  {rows.map((r) => (
                    <tr key={r.user_id} className="[&>td]:py-3 [&>td]:pr-3">
                      <td className="font-medium">
                        <div>{r.name ?? "—"}</div>
                        <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">{r.email ?? "—"}</div>
                      </td>
                      <td className="text-xs">{roleLabel(r.role)}</td>
                      <td className="text-xs">{statusLabel(r)}</td>
                      <td className="text-xs text-[rgb(var(--lp-muted))]">{fmt(r.last_active_at ?? r.created_at)}</td>
                      <td className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            disabled={busyId === r.user_id || Boolean(r.deleted_at) || Boolean(r.disabled_at) || r.is_active === false}
                            onClick={() => deactivateUser(r.user_id)}
                            className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
                          >
                            {busyId === r.user_id ? "..." : "Deaktiver"}
                          </button>
                          <button
                            disabled={busyId === r.user_id || Boolean(r.deleted_at)}
                            onClick={() => setConfirmState({ user_id: r.user_id, name: r.name, email: r.email })}
                            className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
                          >
                            {busyId === r.user_id ? "..." : "Slett"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-xs text-[rgb(var(--lp-muted))]">
            <div>
              Totalt: <span className="font-semibold">{total}</span> · Side {page} / {pageCount}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl bg-white px-3 py-2 ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
              >
                Forrige
              </button>
              <button
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="rounded-xl bg-white px-3 py-2 ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
              >
                Neste
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="lp-motion-overlay lp-glass-overlay absolute inset-0"
            aria-hidden
            onClick={() => setConfirmState(null)}
          />
          <div className="lp-motion-overlay lp-glass-panel relative z-10 w-full max-w-lg rounded-3xl p-6">
            <div className="text-sm font-semibold">Slett ansatt</div>
            <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
              Denne handlingen deaktiverer og anonymiserer brukeren. Historikk beholdes.
            </div>

            <div className="mt-4 rounded-2xl bg-[rgb(var(--lp-surface))] p-3 text-sm">
              <div className="font-medium">{confirmState.name ?? "—"}</div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">{confirmState.email ?? confirmState.user_id}</div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmState(null)}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))]"
              >
                Avbryt
              </button>
              <button
                onClick={() => softDeleteUser(confirmState.user_id)}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))]"
              >
                Bekreft sletting
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
