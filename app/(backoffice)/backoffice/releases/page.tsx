"use client";

import { useCallback, useEffect, useState } from "react";

type Release = {
  id: string;
  name: string;
  environment: string;
  status: string;
  publish_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReleaseItem = {
  id: string;
  release_id: string;
  variant_id: string;
  page_id: string;
  locale: string;
  environment: string;
  created_at: string;
};

export default function ReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [env, setEnv] = useState<"prod" | "staging">("prod");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ release: Release; items: ReleaseItem[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [addVariantId, setAddVariantId] = useState("");
  const [addPageId, setAddPageId] = useState("");
  const [addLocale, setAddLocale] = useState<"nb" | "en">("nb");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [executeSubmitting, setExecuteSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/releases?environment=${env}`);
      if (!res.ok) throw new Error(res.status === 401 ? "Ikke innlogget" : res.status === 403 ? "Krever superadmin" : `Feil ${res.status}`);
      const data = await res.json();
      if (data?.ok && Array.isArray(data.releases)) setReleases(data.releases);
      else setReleases([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste releases");
    } finally {
      setLoading(false);
    }
  }, [env]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/releases/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(res.status === 404 ? "Ikke funnet" : `Feil ${res.status}`);
      const data = await res.json();
      if (data?.ok && data.release && Array.isArray(data.items)) setDetail({ release: data.release, items: data.items });
      else setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste release");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { fetchReleases(); }, [fetchReleases]);
  useEffect(() => { if (selectedId) fetchDetail(selectedId); else setDetail(null); }, [selectedId, fetchDetail]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreateSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), environment: env }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Feil ${res.status}`);
      }
      const data = await res.json();
      setCreateName("");
      await fetchReleases();
      if (data?.release?.id) setSelectedId(data.release.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke opprette release");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleAddItem = async () => {
    if (!selectedId || !addVariantId.trim() || !addPageId.trim()) return;
    setAddSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/releases/${encodeURIComponent(selectedId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: addVariantId.trim(), pageId: addPageId.trim(), locale: addLocale, environment: detail?.release.environment ?? env }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Feil ${res.status}`);
      }
      setAddVariantId("");
      setAddPageId("");
      if (selectedId) await fetchDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke legge til variant");
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleRemoveItem = async (variantId: string) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/backoffice/releases/${encodeURIComponent(selectedId)}/items/${encodeURIComponent(variantId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Feil ${res.status}`);
      await fetchDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke fjerne");
    }
  };

  const handleSchedule = async () => {
    if (!selectedId) return;
    setScheduleSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/releases/${encodeURIComponent(selectedId)}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish_at: scheduleAt ? new Date(scheduleAt).toISOString() : null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Feil ${res.status}`);
      }
      setScheduleAt("");
      await fetchDetail(selectedId);
      await fetchReleases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke planlegge");
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleExecuteNow = async () => {
    if (!selectedId || !detail) return;
    if (detail.release.status !== "scheduled" && detail.release.status !== "draft") return;
    setExecuteSubmitting(true);
    setError(null);
    try {
      if (detail.release.status === "draft") {
        const schedRes = await fetch(`/api/backoffice/releases/${encodeURIComponent(selectedId)}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publish_at: new Date().toISOString() }),
        });
        if (!schedRes.ok) throw new Error("Kunne ikke planlegge release før kjøring");
      }
      const res = await fetch(`/api/backoffice/releases/${encodeURIComponent(selectedId)}/execute`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Feil ${res.status}`);
      }
      await fetchDetail(selectedId);
      await fetchReleases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke kjøre release");
    } finally {
      setExecuteSubmitting(false);
    }
  };

  const formatDate = (s: string | null) => (s ? new Date(s).toLocaleString("nb-NO") : "—");

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900">Releases</h1>
      <p className="mt-1 text-sm text-slate-600">Planlagte og kjørende innholdsreleaser (kun prod i MVP).</p>

      <div className="mt-4 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Miljø:</span>
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value as "prod" | "staging")}
            className="rounded border border-slate-200 px-2 py-1 text-sm"
          >
            <option value="prod">prod</option>
            <option value="staging">staging</option>
          </select>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Navn på ny release"
            className="rounded border border-slate-200 px-3 py-1.5 text-sm w-56"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={createSubmitting || !createName.trim()}
            className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createSubmitting ? "Oppretter…" : "Opprett release"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Release-liste</h2>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Laster…</p>
          ) : releases.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Ingen releases.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {releases.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded px-2 py-1.5 text-left text-sm ${selectedId === r.id ? "bg-slate-100 font-medium" : "hover:bg-slate-50"}`}
                  >
                    <span className="text-slate-900">{r.name}</span>
                    <span className="ml-2 text-slate-500">({r.status})</span>
                    {r.publish_at && <span className="ml-2 text-xs text-slate-400">{formatDate(r.publish_at)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Detalj</h2>
          {!selectedId ? (
            <p className="mt-2 text-sm text-slate-500">Velg en release.</p>
          ) : detailLoading ? (
            <p className="mt-2 text-sm text-slate-500">Laster…</p>
          ) : detail ? (
            <div className="mt-3 space-y-4">
              <div>
                <p className="text-sm text-slate-700"><strong>{detail.release.name}</strong> — {detail.release.status}</p>
                <p className="text-xs text-slate-500">Publiseres: {formatDate(detail.release.publish_at)}</p>
              </div>

              <div>
                <h3 className="text-xs font-medium text-slate-600">Varianter ({detail.items.length})</h3>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                  {detail.items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                      <span>{i.variant_id.slice(0, 8)}… page={i.page_id.slice(0, 8)}… {i.locale}</span>
                      {detail.release.status === "draft" && (
                        <button type="button" onClick={() => handleRemoveItem(i.variant_id)} className="text-red-600 hover:underline">Fjern</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {detail.release.status === "draft" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={addVariantId}
                      onChange={(e) => setAddVariantId(e.target.value)}
                      placeholder="variantId"
                      className="rounded border border-slate-200 px-2 py-1 text-xs w-32"
                    />
                    <input
                      type="text"
                      value={addPageId}
                      onChange={(e) => setAddPageId(e.target.value)}
                      placeholder="pageId"
                      className="rounded border border-slate-200 px-2 py-1 text-xs w-32"
                    />
                    <select value={addLocale} onChange={(e) => setAddLocale(e.target.value as "nb" | "en")} className="rounded border border-slate-200 px-2 py-1 text-xs">
                      <option value="nb">nb</option>
                      <option value="en">en</option>
                    </select>
                    <button type="button" onClick={handleAddItem} disabled={addSubmitting || !addVariantId.trim() || !addPageId.trim()} className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-700 disabled:opacity-50">
                      Legg til
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value ?? "")}
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                    />
                    <button type="button" onClick={handleSchedule} disabled={scheduleSubmitting} className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-700 disabled:opacity-50">
                      Planlegg
                    </button>
                  </div>
                </>
              )}

              {(detail.release.status === "scheduled" || detail.release.status === "draft") && (
                <button
                  type="button"
                  onClick={handleExecuteNow}
                  disabled={executeSubmitting}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {executeSubmitting ? "Kjører…" : "Kjør nå"}
                </button>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Kunne ikke laste release.</p>
          )}
        </div>
      </div>
    </div>
  );
}
