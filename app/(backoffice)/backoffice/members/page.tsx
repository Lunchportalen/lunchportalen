"use client";

import { useCallback, useEffect, useState } from "react";

type MemberItem = {
  id: string | null;
  email: string | null;
  name: string | null;
  department: string | null;
  phone: string | null;
  role: string | null;
  company_id: string | null;
  location_id: string | null;
  disabled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type EmployeesResponse =
  | { ok: true; rid: string; data: { items?: unknown } | unknown }
  | { ok: false; rid: string; error: string; message: string; status: number };

export default function MembersPage() {
  const [items, setItems] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as EmployeesResponse | null;
      if (!res.ok || !json || (json as any).ok === false) {
        const msg =
          (json as any)?.message ||
          (json as any)?.error ||
          (res.status === 401
            ? "Ikke innlogget."
            : res.status === 403
            ? "Ingen tilgang til medlemsliste."
            : `Kunne ikke hente medlemmer (status ${res.status}).`);
        setError(String(msg));
        setItems([]);
        return;
      }
      const data = (json as any).data;
      const raw =
        data != null && typeof data === "object" && !Array.isArray(data)
          ? (data as { items?: unknown }).items ?? []
          : Array.isArray(data)
          ? data
          : [];
      const list = Array.isArray(raw) ? (raw as MemberItem[]) : [];
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil ved henting av medlemmer.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const localFiltered = items.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const email = (m.email ?? "").toLowerCase();
    const name = (m.name ?? "").toLowerCase();
    const dept = (m.department ?? "").toLowerCase();
    const role = (m.role ?? "").toLowerCase();
    return email.includes(q) || name.includes(q) || dept.includes(q) || role.includes(q);
  });

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-900">Medlemmer</h1>
      <p className="mt-1 text-sm text-slate-600">
        Oversikt over ansatte/medlemmer tilknyttet gjeldende firma. Data hentes direkte fra firmaskopet og er skrivebeskyttet.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk etter navn, e-post, avdeling eller rolle…"
          className="h-9 w-full max-w-xs rounded border border-slate-200 px-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Laster…" : "Oppdater"}
        </button>
        {!loading && (
          <span className="text-xs text-slate-500">
            Viser {localFiltered.length} av {items.length} medlemmer
          </span>
        )}
      </div>

      {error ? (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && items.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">Laster medlemmer…</p>
        ) : localFiltered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">
            {items.length === 0
              ? "Ingen medlemmer funnet for dette firmaet."
              : "Ingen medlemmer matcher søket. Prøv et annet søk."}
          </p>
        ) : (
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Navn
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  E-post
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Avdeling
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Rolle
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Scope
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {localFiltered.map((m, idx) => {
                const scope =
                  (m.company_id || m.location_id) ? `${m.company_id ?? ""}${m.location_id ? ` / ${m.location_id}` : ""}` : "—";
                const isDisabled = !!m.disabled_at;
                return (
                  <tr key={m.id ?? `row-${idx}`} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-900">
                      {m.name || "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {m.email || "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {m.department || "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {m.role || "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {scope}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {isDisabled ? "Deaktivert" : "Aktiv"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
