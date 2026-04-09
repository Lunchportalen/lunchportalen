"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AiConfigRow = {
  id: string;
  model: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  system_prompt?: string | null;
  features?: unknown;
  updated_at?: string | null;
  updated_by?: string | null;
};

type ApiOk<T> = { ok: true; rid: string; data: T };
type ApiErr = { ok: false; rid: string; message: string; status?: number; error?: string };

export default function AiConfigPage() {
  const [config, setConfig] = useState<AiConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/superadmin/ai-config", { credentials: "include" });
      const j = (await r.json()) as ApiOk<AiConfigRow> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg = (j as ApiErr).message && typeof (j as ApiErr).message === "string" ? (j as ApiErr).message : "Kunne ikke laste konfigurasjon.";
        setError(msg);
        setConfig(null);
        return;
      }
      setConfig(j.data);
    } catch {
      setError("Nettverksfeil ved lasting.");
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await fetch("/api/superadmin/ai-config", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.max_tokens,
          system_prompt: config.system_prompt,
          features: config.features,
        }),
      });
      const j = (await r.json()) as ApiOk<{ ok: boolean }> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg = (j as ApiErr).message && typeof (j as ApiErr).message === "string" ? (j as ApiErr).message : "Lagring feilet.";
        setError(msg);
        return;
      }
      setSaved(true);
      void load();
    } catch {
      setError("Nettverksfeil ved lagring.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">Laster AI-konfigurasjon…</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 space-y-4 max-w-xl">
        <h1 className="text-xl font-semibold text-slate-900">AI Config</h1>
        {error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-slate-600">Ingen data.</p>}
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Prøv igjen
        </button>
        <p className="text-xs text-slate-500">
          Sørg for at tabellen <code className="font-mono">ai_config</code> finnes og har minst én rad.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/ai" className="text-sm text-slate-600 hover:text-slate-900">
          ← Tilbake til AI Command Center
        </Link>
        <Link href="/backoffice/system/ai-prompts" className="text-sm text-slate-600 hover:text-slate-900">
          AI Prompts →
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Config</h1>
        <p className="mt-1 text-sm text-slate-600">Modell og prompt fra database. Krever gyldig rad i <code className="font-mono text-xs">ai_config</code>.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-green-700">Lagret.</p> : null}

      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-800">Modell</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
            value={config.model ?? ""}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            autoComplete="off"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-800">Temperature</span>
          <input
            type="number"
            step="0.1"
            min={0}
            max={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={config.temperature ?? ""}
            onChange={(e) => setConfig({ ...config, temperature: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-800">Max tokens</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={config.max_tokens ?? ""}
            onChange={(e) => setConfig({ ...config, max_tokens: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-800">System prompt</span>
          <textarea
            className="min-h-[160px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={config.system_prompt ?? ""}
            onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
          />
        </label>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? "Lagrer…" : "Lagre"}
      </button>
    </div>
  );
}
