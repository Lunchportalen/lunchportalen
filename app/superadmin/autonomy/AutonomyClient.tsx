"use client";

import { useCallback, useEffect, useState } from "react";

type AutonomyMode = "dry-run" | "semi" | "auto";

type ConfigPayload = {
  enabled: boolean;
  mode: AutonomyMode;
  limits: { maxActionsPerRun: number };
  allow: Record<string, boolean>;
  source: string;
};

type RunResult = {
  rid: string;
  effectiveMode: AutonomyMode;
  configSource: string;
  results: Array<{
    id: string;
    type: string;
    status: string;
    detail?: string;
    reason?: string;
  }>;
  signals?: unknown;
  verification?: { errorsDelta: number };
};

export default function AutonomyClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigPayload | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<AutonomyMode>("dry-run");
  const [windowDays, setWindowDays] = useState(30);
  const [forceDryRun, setForceDryRun] = useState(true);
  const [approveSequence, setApproveSequence] = useState(false);
  const [approveCopy, setApproveCopy] = useState(false);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [growthPageId, setGrowthPageId] = useState("");
  const [growthCompanyId, setGrowthCompanyId] = useState("");
  const [growthUserId, setGrowthUserId] = useState("");
  const [growthLocale, setGrowthLocale] = useState("nb");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/superadmin/autonomy", { cache: "no-store", credentials: "same-origin" });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { config?: ConfigPayload };
        message?: string;
      };
      if (!json.ok || !json.data?.config) {
        setErr(json.message ?? "Kunne ikke laste konfigurasjon.");
        return;
      }
      const c = json.data.config;
      setConfig(c);
      setEnabled(c.enabled);
      setMode(c.mode);
    } catch {
      setErr("Nettverksfeil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/superadmin/autonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ enabled, mode }),
      });
      const json = (await res.json()) as { ok?: boolean; data?: { config?: ConfigPayload }; message?: string };
      if (!json.ok || !json.data?.config) {
        setErr(json.message ?? "Lagring feilet.");
        return;
      }
      setConfig(json.data.config);
      setEnabled(json.data.config.enabled);
      setMode(json.data.config.mode);
    } catch {
      setErr("Nettverksfeil ved lagring.");
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    setRunning(true);
    setErr(null);
    setLastRun(null);
    const approved: string[] = [];
    if (approveSequence) approved.push("adjust_sequence");
    if (approveCopy) approved.push("update_copy");
    try {
      const growth =
        growthPageId.trim().length > 0 && growthCompanyId.trim().length > 0
          ? {
              pageId: growthPageId.trim(),
              companyId: growthCompanyId.trim(),
              ...(growthUserId.trim() ? { userId: growthUserId.trim() } : {}),
              ...(growthLocale.trim() ? { locale: growthLocale.trim() } : {}),
            }
          : undefined;
      const res = await fetch("/api/autonomy/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          windowDays,
          forceDryRun,
          approvedActionTypes: approved.length ? approved : undefined,
          growth,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: RunResult;
        message?: string;
      };
      if (!json.ok || !json.data) {
        setErr(json.message ?? "Kjøring feilet.");
        return;
      }
      setLastRun(json.data);
    } catch {
      setErr("Nettverksfeil ved kjøring.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Autonom modus</h1>
        <p className="mt-1 text-sm text-slate-600">
          Policy-styrt: kun trygge operasjoner uten eksplisitt godkjenning (f.eks. outbox-retry, observe). Risiko
          (sekvensutkast, cache-invalidering) krever avkryssing. Ingen skjemamigrering eller sletting.
        </p>
      </div>

      {loading && <p className="text-sm text-slate-500">Laster…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && config && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Konfigurasjon</h2>
          <p className="mb-3 text-xs text-slate-500">
            Kilde: <strong>{config.source}</strong> (env + valgfritt override i audit-logg)
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Aktivert (kill switch av når avkrysset bort)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Modus
              <select
                className="rounded-lg border border-slate-200 px-2 py-1"
                value={mode}
                onChange={(e) => setMode(e.target.value as AutonomyMode)}
              >
                <option value="dry-run">dry-run</option>
                <option value="semi">semi</option>
                <option value="auto">auto</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-full border border-slate-900 bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Lagrer…" : "Lagre override"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Maks handlinger per kjøring: {config.limits.maxActionsPerRun}</p>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Kjør analyse / handling</h2>
        <div className="flex flex-col gap-3">
          <label className="flex w-fit flex-col gap-1 text-sm text-slate-700">
            Vindu (dager)
            <input
              type="number"
              min={7}
              max={90}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1"
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={forceDryRun} onChange={(e) => setForceDryRun(e.target.checked)} />
            Tving dry-run for denne kjøringen
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p className="font-medium text-slate-900">Vekst (AI + CMS preview)</p>
            <p className="mt-1 text-xs text-slate-600">
              Fyll inn side-ID og firma-ID for å aktivere veksteksperiment (preview + versjon) og sekvensforbedring
              (logges som variant). Valgfritt: bruker-ID (standard: innlogget superadmin). Tom = bruk env{" "}
              <code className="text-[11px]">AUTONOMY_GROWTH_*</code> hvis satt.
            </p>
            <div className="mt-2 grid max-w-lg gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-0.5 text-xs">
                pageId
                <input
                  className="rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                  value={growthPageId}
                  onChange={(e) => setGrowthPageId(e.target.value)}
                  placeholder="uuid"
                  autoComplete="off"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-xs">
                companyId
                <input
                  className="rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                  value={growthCompanyId}
                  onChange={(e) => setGrowthCompanyId(e.target.value)}
                  placeholder="uuid"
                  autoComplete="off"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-xs">
                userId (valgfritt)
                <input
                  className="rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                  value={growthUserId}
                  onChange={(e) => setGrowthUserId(e.target.value)}
                  placeholder="profil-uuid"
                  autoComplete="off"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-xs">
                locale
                <input
                  className="rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                  value={growthLocale}
                  onChange={(e) => setGrowthLocale(e.target.value)}
                  placeholder="nb"
                  autoComplete="off"
                />
              </label>
            </div>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-medium">Godkjenn risiko for denne kjøringen</p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={approveSequence} onChange={(e) => setApproveSequence(e.target.checked)} />
              Tillat adjust_sequence (sekvensmotor — utkast, ikke auto-send; variant logges ved vekst-kontekst)
            </label>
            <label className="mt-1 flex items-center gap-2">
              <input type="checkbox" checked={approveCopy} onChange={(e) => setApproveCopy(e.target.checked)} />
              Tillat update_copy (veksteksperiment på preview når vekst-kontekst er satt; ellers cache-invalidering)
            </label>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={running}
            className="w-fit rounded-full border border-slate-900 px-5 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            {running ? "Kjører…" : "Kjør autonomi"}
          </button>
        </div>
      </section>

      {lastRun && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Siste resultat</h2>
          <p className="text-xs text-slate-500">
            rid <span className="font-mono">{lastRun.rid}</span> · modus {lastRun.effectiveMode} · config{" "}
            {lastRun.configSource}
          </p>
          {lastRun.verification && (
            <p className="mt-1 text-xs text-slate-600">Feil delta (før–etter): {lastRun.verification.errorsDelta}</p>
          )}
          <ul className="mt-2 space-y-2">
            {lastRun.results.map((r) => (
              <li key={r.id} className="rounded border border-slate-100 bg-slate-50 p-2 text-xs font-mono text-slate-800">
                {r.type} · {r.status}
                {r.detail ? ` · ${r.detail}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
