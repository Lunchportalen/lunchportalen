"use client";

import { useCallback, useEffect, useState } from "react";

type JobRow = {
  id: string;
  tool: string;
  status: string;
  attempts: number;
  max_attempts: number;
  next_run_at: string | null;
  created_at: string;
  error: string | null;
};

type HealthRow = {
  pageId: string;
  variantId: string | null;
  score: number;
  issues: unknown[];
  createdAt: string;
};

type ExperimentVariant = {
  variant: string;
  views: number;
  clicks: number;
  conversions: number;
};

export default function AIControlPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [runJobsSubmitting, setRunJobsSubmitting] = useState(false);
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [scanSubmitting, setScanSubmitting] = useState(false);
  const [experimentId, setExperimentId] = useState("");
  const [experimentStats, setExperimentStats] = useState<{
    views: number;
    clicks: number;
    conversions: number;
    variants: string[];
    byVariant?: ExperimentVariant[];
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/ai/jobs");
      if (!res.ok) throw new Error(res.status === 401 ? "Ikke innlogget" : res.status === 403 ? "Krever superadmin" : `Feil ${res.status}`);
      const data = await res.json();
      const raw = data?.data?.data ?? data?.data;
      setJobs(Array.isArray(raw) ? raw : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste jobs");
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/ai/health/latest");
      if (!res.ok) throw new Error(res.status === 401 ? "Ikke innlogget" : res.status === 403 ? "Krever superadmin" : `Feil ${res.status}`);
      const data = await res.json();
      const raw = data?.data?.data ?? data?.data;
      setHealth(Array.isArray(raw) ? raw : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste health");
      setHealth([]);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRunJobs = async () => {
    setRunJobsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/ai/jobs/run", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Feil ${res.status}`);
      }
      await fetchJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke kjøre jobs");
    } finally {
      setRunJobsSubmitting(false);
    }
  };

  const handleScanHealth = async () => {
    setScanSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/ai/health/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Feil ${res.status}`);
      }
      await fetchHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke kjøre health-scan");
    } finally {
      setScanSubmitting(false);
    }
  };

  const handleLoadStats = async () => {
    if (!experimentId.trim()) return;
    setStatsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/experiments/stats?experimentId=${encodeURIComponent(experimentId.trim())}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Feil ${res.status}`);
      }
      const data = await res.json();
      setExperimentStats(data?.data?.data ?? data?.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste statistikk");
      setExperimentStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const formatDate = (s: string | null) => (s ? new Date(s).toLocaleString("nb-NO") : "–");

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-900">AI Control Center</h1>
      <p className="mt-1 text-sm text-slate-600">Kjøre jobs, innholdshelse og eksperimentstatistikk (kun superadmin).</p>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Jobs</h2>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunJobs}
            disabled={runJobsSubmitting}
            className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {runJobsSubmitting ? "Kjører…" : "Run Jobs Now"}
          </button>
          <button type="button" onClick={fetchJobs} className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Oppdater
          </button>
        </div>
        {jobsLoading ? (
          <p className="mt-2 text-sm text-slate-500">Laster…</p>
        ) : jobs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Ingen jobs.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-1.5 pr-2 font-medium text-slate-700">Status</th>
                  <th className="py-1.5 pr-2 font-medium text-slate-700">Tool</th>
                  <th className="py-1.5 pr-2 font-medium text-slate-700">Forsøk</th>
                  <th className="py-1.5 pr-2 font-medium text-slate-700">Neste kjøring</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-800">{j.status}</td>
                    <td className="py-1.5 pr-2 text-slate-700">{j.tool}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{j.attempts}/{j.max_attempts}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{formatDate(j.next_run_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Content Health</h2>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleScanHealth}
            disabled={scanSubmitting}
            className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {scanSubmitting ? "Skanner…" : "Scan Health Now"}
          </button>
          <button type="button" onClick={fetchHealth} className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Oppdater
          </button>
        </div>
        {healthLoading ? (
          <p className="mt-2 text-sm text-slate-500">Laster…</p>
        ) : health.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Ingen health-data. Kjør scan.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-1.5 pr-2 font-medium text-slate-700">Page ID</th>
                  <th className="py-1.5 pr-2 font-medium text-slate-700">Score</th>
                  <th className="py-1.5 pr-2 font-medium text-slate-700">Antall issues</th>
                  <th className="py-1.5 pr-2 font-medium text-slate-700">Opprettet</th>
                </tr>
              </thead>
              <tbody>
                {health.map((h, i) => (
                  <tr key={`${h.pageId}-${h.variantId ?? ""}-${i}`} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-800 font-mono text-xs">{h.pageId.slice(0, 8)}…</td>
                    <td className="py-1.5 pr-2 text-slate-700">{h.score}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{Array.isArray(h.issues) ? h.issues.length : 0}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{formatDate(h.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Experiments</h2>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={experimentId}
            onChange={(e) => setExperimentId(e.target.value)}
            placeholder="experimentId"
            className="rounded border border-slate-200 px-3 py-1.5 text-sm w-48 font-mono"
          />
          <button
            type="button"
            onClick={handleLoadStats}
            disabled={statsLoading || !experimentId.trim()}
            className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {statsLoading ? "Laster…" : "Load stats"}
          </button>
        </div>
        {experimentStats && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-slate-700">
              Totalt: views {experimentStats.views}, clicks {experimentStats.clicks}, conversions {experimentStats.conversions}
            </p>
            {Array.isArray(experimentStats.byVariant) && experimentStats.byVariant.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-1.5 pr-2 font-medium text-slate-700">Variant</th>
                      <th className="py-1.5 pr-2 font-medium text-slate-700">Views</th>
                      <th className="py-1.5 pr-2 font-medium text-slate-700">Clicks</th>
                      <th className="py-1.5 pr-2 font-medium text-slate-700">Conversions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {experimentStats.byVariant.map((v) => (
                      <tr key={v.variant} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2 text-slate-800">{v.variant}</td>
                        <td className="py-1.5 pr-2 text-slate-600">{v.views}</td>
                        <td className="py-1.5 pr-2 text-slate-600">{v.clicks}</td>
                        <td className="py-1.5 pr-2 text-slate-600">{v.conversions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
