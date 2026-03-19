"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { formatDateNO } from "@/lib/date/format";

type ExperimentRow = {
  id: string;
  page_id: string;
  name: string;
  type: string;
  status: string;
  experiment_id: string;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
};

type PageRow = { id: string; title: string; slug: string };

const STATUS_LABEL: Record<string, string> = {
  draft: "Kladd",
  active: "Aktiv",
  paused: "Pauset",
  completed: "Fullført",
};
const TYPE_LABEL: Record<string, string> = {
  headline: "Overskrift",
  cta: "CTA",
  hero_body: "Hero/tekst",
};

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<ExperimentRow[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPageId, setCreatePageId] = useState("");
  const [createType, setCreateType] = useState<"headline" | "cta" | "hero_body">("headline");
  const [createVariants, setCreateVariants] = useState([{ key: "A", label: "Variant A" }, { key: "B", label: "Variant B" }]);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const fetchExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/experiments");
      if (!res.ok) throw new Error(res.status === 401 ? "Ikke innlogget" : res.status === 403 ? "Krever superadmin" : `Feil ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : [];
      setExperiments(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste eksperimenter");
      setExperiments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch("/api/backoffice/content/pages?limit=100");
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : Array.isArray(data?.pages) ? data.pages : [];
      setPages(list);
      if (list.length > 0 && !createPageId) setCreatePageId(list[0].id);
    } catch {
      setPages([]);
    }
  }, [createPageId]);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);
  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleCreate = async () => {
    if (!createName.trim() || !createPageId) return;
    setCreateSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: createPageId,
          name: createName.trim(),
          type: createType,
          config: { variants: createVariants },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Feil ${res.status}`);
      setCreateOpen(false);
      setCreateName("");
      setCreateVariants([{ key: "A", label: "Variant A" }, { key: "B", label: "Variant B" }]);
      fetchExperiments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke opprette eksperiment");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const pageById = Object.fromEntries(pages.map((p) => [p.id, p]));

  return (
    <div className="flex h-full flex-col overflow-auto bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-[rgb(var(--lp-text))]">Eksperimenter (CRO)</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))]"
        >
          <Icon name="add" size="sm" />
          Opprett eksperiment
        </button>
      </div>
      <p className="mb-4 text-sm text-[rgb(var(--lp-muted))]">
        Redaksjonelle A/B-eksperimenter for overskrift, CTA og hero/tekst. Ingen trafikdeling uten eksplisitt konfigurasjon. Status: kladd → aktiv → pauset/fullført.
      </p>
      {error ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{error}</div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--lp-muted))]">
          <Icon name="loading" size="sm" className="animate-spin" />
          Laster…
        </div>
      ) : experiments.length === 0 ? (
        <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 p-8 text-center text-sm text-[rgb(var(--lp-muted))]">
          Ingen eksperimenter ennå. Opprett ett for å komme i gang.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[rgb(var(--lp-border))]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[rgb(var(--lp-border))] bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-medium text-[rgb(var(--lp-text))]">Navn</th>
                <th className="px-4 py-3 font-medium text-[rgb(var(--lp-text))]">Side</th>
                <th className="px-4 py-3 font-medium text-[rgb(var(--lp-text))]">Type</th>
                <th className="px-4 py-3 font-medium text-[rgb(var(--lp-text))]">Status</th>
                <th className="px-4 py-3 font-medium text-[rgb(var(--lp-text))]">Opprettet</th>
                <th className="px-4 py-3 font-medium text-[rgb(var(--lp-text))]"></th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((row) => (
                <tr key={row.id} className="border-b border-[rgb(var(--lp-border))]/60">
                  <td className="px-4 py-3 font-medium text-[rgb(var(--lp-text))]">{row.name}</td>
                  <td className="px-4 py-3 text-[rgb(var(--lp-muted))]">
                    {pageById[row.page_id]?.title ?? row.page_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-[rgb(var(--lp-muted))]">{TYPE_LABEL[row.type] ?? row.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                        row.status === "active"
                          ? "border-green-200 bg-green-50 text-green-800"
                          : row.status === "completed"
                            ? "border-slate-200 bg-slate-100 text-slate-700"
                            : row.status === "paused"
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[rgb(var(--lp-muted))]">
                    {formatDateNO(row.created_at.slice(0, 10))}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/backoffice/experiments/${row.id}`}
                      className="text-[rgb(var(--lp-ring))] hover:underline"
                    >
                      Åpne
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="lp-motion-overlay lp-glass-overlay absolute inset-0"
            aria-hidden
            onClick={() => setCreateOpen(false)}
          />
          <div className="lp-motion-overlay lp-glass-panel relative z-10 w-full max-w-md rounded-xl p-6">
            <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--lp-text))]">Opprett eksperiment</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-[rgb(var(--lp-muted))]">Navn</span>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
                  placeholder="F.eks. Forside hero A/B"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[rgb(var(--lp-muted))]">Side</span>
                <select
                  value={createPageId}
                  onChange={(e) => setCreatePageId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
                >
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.slug})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[rgb(var(--lp-muted))]">Type</span>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as "headline" | "cta" | "hero_body")}
                  className="mt-1 w-full rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
                >
                  <option value="headline">Overskrift</option>
                  <option value="cta">CTA</option>
                  <option value="hero_body">Hero/tekst</option>
                </select>
              </label>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Varianter konfigureres etter opprettelse. Minst to varianter (A, B) kreves.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!createName.trim() || !createPageId || createSubmitting}
                className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-ring))] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {createSubmitting ? "Oppretter…" : "Opprett"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
