"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ApiOk<T> = { ok: true; rid: string; data: T };
type ApiErr = { ok: false; rid: string; message: string; status?: number; error?: string };

type AiConfigRow = {
  id: string;
  features?: unknown;
};

export default function AiPromptsPage() {
  const [prompts, setPrompts] = useState<Record<string, string>>({});
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
        const msg = (j as ApiErr).message && typeof (j as ApiErr).message === "string" ? (j as ApiErr).message : "Kunne ikke laste.";
        setError(msg);
        return;
      }
      const f = j.data.features;
      const registry: Record<string, string> = {};
      if (f && typeof f === "object" && !Array.isArray(f)) {
        const pr = (f as Record<string, unknown>).prompt_registry;
        if (pr && typeof pr === "object" && !Array.isArray(pr)) {
          for (const [k, v] of Object.entries(pr)) {
            if (typeof v === "string") registry[k] = v;
          }
        }
      }
      setPrompts(registry);
    } catch {
      setError("Nettverksfeil ved lasting.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await fetch("/api/superadmin/ai-prompts", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompts),
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

  const keys = ["editor", "seo", "growth", "product", "support"] as const;

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">Laster prompt-register…</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/system/ai-config" className="text-sm text-slate-600 hover:text-slate-900">
          ← AI Config
        </Link>
        <Link href="/backoffice/ai" className="text-sm text-slate-600 hover:text-slate-900">
          AI Command Center →
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Prompts</h1>
        <p className="mt-1 text-sm text-slate-600">
          System prompts per område. Lagres i <code className="font-mono text-xs">ai_config.features.prompt_registry</code>. Krever utfylte
          editor, seo og growth for at <code className="font-mono text-xs">runAI</code> skal kjøre.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-green-700">Lagret.</p> : null}

      <div className="space-y-4">
        {keys.map((key) => (
          <label key={key} className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">{key}</span>
            <textarea
              className="min-h-[120px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              value={prompts[key] ?? ""}
              onChange={(e) =>
                setPrompts({
                  ...prompts,
                  [key]: e.target.value,
                })
              }
            />
          </label>
        ))}
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
