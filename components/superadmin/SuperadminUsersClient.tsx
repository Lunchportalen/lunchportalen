// components/superadmin/SuperadminUsersClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  user_id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  company_id: string | null;
  company_name: string | null;
  is_active: boolean | null;
  disabled_at: string | null;
  created_at: string | null;
};

type ApiOk = { ok: true; users: Row[]; total: number; page: number; limit: number };
type ApiErr = { ok: false; error: string; message?: string; detail?: any };

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) throw new Error(`Tom respons (HTTP ${res.status})`);
  return JSON.parse(t);
}

export default function SuperadminUsersClient() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("ALL");
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
      const url = `/api/superadmin/users?q=${encodeURIComponent(q.trim())}&role=${encodeURIComponent(
        role
      )}&page=${page}&limit=${limit}`;
      const res = await fetch(url, { headers: { "cache-control": "no-store" } });
      const json = (await readJson(res)) as ApiOk | ApiErr;
      if (!res.ok || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j.message || j.error || `HTTP ${res.status}`);
      }
      const ok = json as ApiOk;
      setRows(ok.users);
      setTotal(ok.total);
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente brukere.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  async function disableUser(user_id: string) {
    if (!confirm("Deaktivere bruker?")) return;
    setBusyId(user_id);
    setErr(null);
    try {
      const res = await fetch("/api/superadmin/users/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id }),
      });
      const json = (await readJson(res)) as { ok: true } | ApiErr;
      if (!res.ok || (json as any).ok !== true)
        throw new Error((json as ApiErr).message || (json as ApiErr).error || "Feil");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke deaktivere.");
    } finally {
      setBusyId(null);
    }
  }

  async function enableUser(user_id: string) {
    if (!confirm("Aktivere bruker igjen?")) return;
    setBusyId(user_id);
    setErr(null);
    try {
      const res = await fetch("/api/superadmin/users/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id }),
      });
      const json = (await readJson(res)) as { ok: true } | ApiErr;
      if (!res.ok || (json as any).ok !== true)
        throw new Error((json as ApiErr).message || (json as ApiErr).error || "Feil");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke aktivere.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(user_id: string) {
    if (!confirm("Slette bruker permanent?\nDette sletter auth + profil + invites.")) return;
    setBusyId(user_id);
    setErr(null);
    try {
      const res = await fetch("/api/superadmin/users/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id }),
      });
      const json = (await readJson(res)) as { ok: true } | ApiErr;
      if (!res.ok || (json as any).ok !== true)
        throw new Error((json as ApiErr).message || (json as ApiErr).error || "Feil");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke slette.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold">Søk</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Søk e-post, navn, firma-ID.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-[280px] max-w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
            placeholder="Søk…"
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
          >
            <option value="ALL">Alle roller</option>
            <option value="employee">employee</option>
            <option value="company_admin">company_admin</option>
            <option value="superadmin">superadmin</option>
            <option value="kitchen">kitchen</option>
            <option value="driver">driver</option>
          </select>

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

      <div className="mt-4 rounded-3xl ring-1 ring-[rgb(var(--lp-border))]">
        <div className="bg-white p-4">
          {loading ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen treff.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-[rgb(var(--lp-muted))]">
                  <tr className="[&>th]:py-2 [&>th]:pr-3">
                    <th>Navn</th>
                    <th>E-post</th>
                    <th>Rolle</th>
                    <th>Firma</th>
                    <th>Status</th>
                    <th className="text-right">Handling</th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-t [&>tr]:border-[rgb(var(--lp-border))]">
                  {rows.map((r) => {
                    const isDisabled = Boolean(r.disabled_at) || r.is_active === false;

                    return (
                      <tr key={r.user_id} className="[&>td]:py-3 [&>td]:pr-3">
                        <td className="font-medium">{r.name ?? "—"}</td>
                        <td>{r.email ?? "—"}</td>
                        <td className="font-mono text-xs">{r.role ?? "—"}</td>
                        <td className="text-xs">
                          {r.company_name ? (
                            <>
                              <div className="font-medium">{r.company_name}</div>
                              <div className="font-mono text-[rgb(var(--lp-muted))]">{r.company_id ?? "—"}</div>
                            </>
                          ) : (
                            <span className="font-mono text-[rgb(var(--lp-muted))]">{r.company_id ?? "—"}</span>
                          )}
                        </td>
                        <td className="text-xs">{r.disabled_at ? "Deaktivert" : r.is_active ? "Aktiv" : "Inaktiv"}</td>
                        <td className="text-right">
                          <div className="inline-flex items-center gap-2">
                            {isDisabled ? (
                              <button
                                disabled={busyId === r.user_id}
                                onClick={() => enableUser(r.user_id)}
                                className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
                              >
                                Aktiver
                              </button>
                            ) : (
                              <button
                                disabled={busyId === r.user_id}
                                onClick={() => disableUser(r.user_id)}
                                className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
                              >
                                Deaktiver
                              </button>
                            )}

                            <button
                              disabled={busyId === r.user_id}
                              onClick={() => deleteUser(r.user_id)}
                              className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
                            >
                              Slett
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
