"use client";

import { useCallback, useEffect, useState } from "react";

type UserListItem = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  company_id: string | null;
  is_active: boolean;
};

type UsersResponse =
  | { ok: true; rid: string; data: { items?: unknown } | unknown }
  | { ok: false; rid: string; error: string; message: string; status: number };

export default function UsersPage() {
  const [items, setItems] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/backoffice/users${params.toString() ? `?${params.toString()}` : ""}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as UsersResponse | null;
      if (!res.ok || !json || (json as any).ok === false) {
        const msg =
          (json as any)?.message ||
          (json as any)?.error ||
          (res.status === 401
            ? "Ikke innlogget."
            : res.status === 403
            ? "Ingen tilgang til brukerliste."
            : `Kunne ikke hente brukere (status ${res.status}).`);
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
      const list = Array.isArray(raw)
        ? (raw.filter((u) => u != null && typeof u === "object") as UserListItem[])
        : [];
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil ved henting av brukere.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const localFiltered = items.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const email = String((u as any).email ?? "").toLowerCase();
    const name = String((u as any).name ?? "").toLowerCase();
    const role = String((u as any).role ?? "").toLowerCase();
    return email.includes(q) || name.includes(q) || role.includes(q);
  });

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-900">Brukere</h1>
      <p className="mt-1 text-sm text-slate-600">
        Oversikt over profiler i systemet. Listen er skrivebeskyttet og tilgjengelig kun for superadmin.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk etter navn, e-post eller rolle…"
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
            Viser {localFiltered.length} av {items.length} brukere
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
          <p className="px-4 py-3 text-sm text-slate-500">Laster brukere…</p>
        ) : localFiltered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">
            {items.length === 0
              ? "Ingen brukere funnet."
              : "Ingen brukere matcher søket. Prøv et annet søk."}
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
                  Rolle
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Firma
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {localFiltered.map((u, i) => (
                <tr key={String((u as any)?.id ?? i)} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-900">
                    {String((u as any)?.name ?? "") || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {String((u as any)?.email ?? "") || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {String((u as any)?.role ?? "") || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {String((u as any)?.company_id ?? "") || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {(u as any)?.is_active === true ? "Aktiv" : "Ikke aktiv"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
