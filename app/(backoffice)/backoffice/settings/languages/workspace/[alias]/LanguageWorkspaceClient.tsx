"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LanguageDefinition } from "@/lib/cms/schema/languageDefinitions";
import { getBaselineLanguageDefinition } from "@/lib/cms/schema/languageDefinitions";
import { buildLanguageAdminOverrideDiff } from "@/lib/cms/schema/languageDefinitionMerge";

type Payload = {
  ok?: boolean;
  data?: { merged: Record<string, LanguageDefinition> };
  message?: string;
};

export function LanguageWorkspaceClient({ alias }: { alias: string }) {
  const baseline = useMemo(() => getBaselineLanguageDefinition(alias), [alias]);
  const [serverMerged, setServerMerged] = useState<LanguageDefinition | null>(null);
  const [form, setForm] = useState<LanguageDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/backoffice/cms/language-definitions", {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const j = (await res.json()) as Payload;
      if (!res.ok || !j?.ok || !j.data?.merged?.[alias]) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      const m = j.data.merged[alias]!;
      setServerMerged(structuredClone(m));
      setForm(structuredClone(m));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste");
      setServerMerged(null);
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [alias]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!form || !serverMerged) return false;
    return JSON.stringify(form) !== JSON.stringify(serverMerged);
  }, [form, serverMerged]);

  const onSave = async () => {
    if (!form || !baseline) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const diff = buildLanguageAdminOverrideDiff(baseline, form);
      const res = await fetch("/api/backoffice/cms/language-definitions", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(
          Object.keys(diff).length === 0 ? { alias, reset: true } : { alias, override: diff },
        ),
      });
      const j = (await res.json()) as Payload;
      if (!res.ok || !j?.ok || !j.data?.merged?.[alias]) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      const m = j.data.merged[alias]!;
      setServerMerged(structuredClone(m));
      setForm(structuredClone(m));
      setSaveMsg("Lagret og publisert.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Lagring feilet");
    } finally {
      setSaving(false);
    }
  };

  if (!baseline) {
    return <div className="p-6 text-sm text-red-800">Ukjent språk-alias.</div>;
  }
  if (loading) return <p className="p-6 text-sm text-slate-600">Laster…</p>;
  if (error || !form) {
    return (
      <div className="m-6 rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900">
        {error ?? "Mangler data"}
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-3xl space-y-6 p-6"
      data-lp-language-workspace={alias}
      data-lp-language-alias={alias}
      data-lp-language-title={form.title}
      data-lp-language-default={form.isDefault ? "true" : "false"}
      data-lp-language-dirty={dirty ? "true" : "false"}
    >
      <nav className="text-sm text-slate-600">
        <Link href="/backoffice/settings/languages" className="hover:text-slate-900">
          ← Språk
        </Link>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-slate-500">{alias}</p>
          <h1 className="text-xl font-semibold text-slate-900">Språk-workspace</h1>
        </div>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void onSave()}
          className="min-h-10 rounded-full border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          data-lp-language-save
        >
          {saving ? "Lagrer…" : "Lagre"}
        </button>
      </div>
      {saveMsg ? (
        <p className="text-sm text-slate-700" role="status" data-lp-language-save-msg>
          {saveMsg}
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-xs font-medium text-slate-700">
          Visningsnavn
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm((p) => (p ? { ...p, title: e.target.value } : p))}
            data-lp-language-title-input
          />
        </label>
        <div className="grid gap-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold">Kulturkode:</span>{" "}
            <span className="font-mono" data-lp-language-culture-readonly>
              {form.cultureCode}
            </span>
          </p>
          <p>
            <span className="font-semibold">Storage locale:</span>{" "}
            <span className="font-mono">{form.storageLocale}</span>
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((p) => (p ? { ...p, enabled: e.target.checked } : p))}
            disabled={form.isMandatory}
            data-lp-language-enabled
          />
          Aktivt språk
        </label>
        {form.isMandatory ? (
          <p className="text-xs text-amber-800">Dette språket er obligatorisk og kan ikke deaktiveres.</p>
        ) : null}
      </section>
    </div>
  );
}
