// components/superadmin/FirmEmployeesClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  user_id: string;
  email: string | null;
  name: string | null;
  department: string | null;
  location_id: string | null;
  is_active: boolean;
  disabled_at: string | null;
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
  try {
    return new Date(ts).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
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

  async function delUser(user_id: string, email: string | null) {
    if (!confirm(`Slette bruker?\n\n${email ?? user_id}\n\nDette sletter auth + profil + invites.`)) return;

    setBusyId(user_id);
    setErr(null);

    try {
      const res = await fetch(`/api/superadmin/firms/${encodeURIComponent(companyId)}/employees/delete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id }),
      });

      const json = (await readJson(res)) as { ok: true; message?: string } | ApiErr;
      if (!res.ok || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j.message || j.error || `HTTP ${res.status}`);
      }

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke slette bruker.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold">Brukere</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Full oversikt per firma. Bruk søk ved behov.</div>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk e-post/navn/avdeling"
            className="w-[320px] max-w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
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
            <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen ansatte funnet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-[rgb(var(--lp-muted))]">
                  <tr className="[&>th]:py-2 [&>th]:pr-3">
                    <th>Navn</th>
                    <th>E-post</th>
                    <th>Avdeling</th>
                    <th>Lokasjon</th>
                    <th>Status</th>
                    <th>Opprettet</th>
                    <th className="text-right">Slett</th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-t [&>tr]:border-[rgb(var(--lp-border))]">
                  {rows.map((r) => (
                    <tr key={r.user_id} className="[&>td]:py-3 [&>td]:pr-3">
                      <td className="font-medium">{r.name ?? "—"}</td>
                      <td>{r.email ?? "—"}</td>
                      <td>{r.department ?? "—"}</td>
                      <td className="font-mono text-xs">{r.location_id ?? "—"}</td>
                      <td className="text-xs">{r.disabled_at ? "Deaktivert" : r.is_active ? "Aktiv" : "Inaktiv"}</td>
                      <td className="text-xs text-[rgb(var(--lp-muted))]">{fmt(r.created_at)}</td>
                      <td className="text-right">
                        <button
                          disabled={busyId === r.user_id}
                          onClick={() => delUser(r.user_id, r.email)}
                          className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
                        >
                          {busyId === r.user_id ? "…" : "Slett"}
                        </button>
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
    </div>
  );
}
