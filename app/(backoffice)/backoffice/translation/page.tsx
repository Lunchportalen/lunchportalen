"use client";

import { useCallback, useEffect, useState } from "react";

type LocaleEnvStats = { pages: number; variants: number };

type LocaleSummary = {
  locale: string;
  totalVariants: number;
  pageCount: number;
  environments: Record<string, LocaleEnvStats>;
};

type SummaryResponse =
  | { ok: true; rid: string; data: { summary?: unknown } | unknown }
  | { ok: false; rid: string; error: string; message: string; status: number };

export default function TranslationPage() {
  const [summary, setSummary] = useState<LocaleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/translation/summary", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as SummaryResponse | null;
      if (!res.ok || !json || (json as any).ok === false) {
        const msg =
          (json as any)?.message ||
          (json as any)?.error ||
          (res.status === 401
            ? "Ikke innlogget."
            : res.status === 403
            ? "Ingen tilgang til oversettelsesstatus."
            : `Kunne ikke hente oversettelsesstatus (status ${res.status}).`);
        setError(String(msg));
        setSummary([]);
        return;
      }
      const data = (json as any).data;
      const raw =
        data != null && typeof data === "object" && !Array.isArray(data)
          ? (data as { summary?: unknown }).summary ?? []
          : Array.isArray(data)
          ? data
          : [];
      const list = Array.isArray(raw) ? (raw as LocaleSummary[]) : [];
      setSummary(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil ved henting av oversettelsesstatus.");
      setSummary([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900">Oversettelser</h1>
      <p className="mt-1 text-sm text-slate-600">
        Oversikt over innholdsvarianter per språk og miljø. Basert på faktiske <code>content_page_variants</code>‑rader.
      </p>

      <div className="mt-4 flex items-center gap-3 text-sm">
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
            {summary.length === 0
              ? "Ingen varianter funnet."
              : `Viser ${summary.length} språk`}
          </span>
        )}
      </div>

      {error ? (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {loading && summary.length === 0 ? (
          <p className="text-sm text-slate-500">Laster oversettelsesdata…</p>
        ) : summary.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ingen innholdsvarianter registrert ennå. Opprett sider for å se språkstatus.
          </p>
        ) : (
          summary.map((loc) => (
            <section
              key={loc.locale}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <header className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Språk: <span className="font-mono">{loc.locale}</span>
                  </h2>
                  <p className="text-xs text-slate-600">
                    {loc.pageCount} sider, {loc.totalVariants} varianter totalt.
                  </p>
                </div>
              </header>
              <div className="mt-3 overflow-hidden rounded border border-slate-200">
                <table className="min-w-full border-collapse text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-1.5 text-left font-medium text-slate-700">
                        Miljø
                      </th>
                      <th className="border-b border-slate-200 px-3 py-1.5 text-left font-medium text-slate-700">
                        Sider med variant
                      </th>
                      <th className="border-b border-slate-200 px-3 py-1.5 text-left font-medium text-slate-700">
                        Antall varianter
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(loc.environments).map(([env, stats]) => (
                      <tr key={env} className="hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-3 py-1.5 text-slate-800">
                          {env}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-1.5 text-slate-700">
                          {stats.pages}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-1.5 text-slate-700">
                          {stats.variants}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
