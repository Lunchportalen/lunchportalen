"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementTypeRuntimeMergedEntry, ElementTypeRuntimeMergedPayload } from "@/lib/cms/schema/elementTypeRuntimeMerge";
import {
  buildElementTypeRuntimeAdminOverrideDiff,
  cloneElementTypeRuntimeForForm,
  elementTypeRuntimeEntriesEqual,
} from "@/lib/cms/schema/elementTypeRuntimeMerge";

type Payload = ElementTypeRuntimeMergedPayload & { aliases?: string[] };

export function ElementTypeWorkspaceClient({ alias }: { alias: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [form, setForm] = useState<ElementTypeRuntimeMergedEntry | null>(null);
  const [baselineForm, setBaselineForm] = useState<ElementTypeRuntimeMergedEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/backoffice/cms/element-type-runtime", {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; data?: Payload };
      if (!res.ok || !j?.ok || !j.data?.merged) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      setPayload(j.data);
      const merged = j.data.merged[alias];
      if (!merged) throw new Error("Ukjent elementtype.");
      const cloned = structuredClone(merged) as ElementTypeRuntimeMergedEntry;
      setForm(cloned);
      setBaselineForm(structuredClone(cloned));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste");
      setPayload(null);
      setForm(null);
      setBaselineForm(null);
    } finally {
      setLoading(false);
    }
  }, [alias]);

  useEffect(() => {
    void load();
  }, [load]);

  const codeBaseline = useMemo(() => cloneElementTypeRuntimeForForm(alias), [alias]);

  const dirty = useMemo(() => {
    if (!form || !baselineForm) return false;
    return !elementTypeRuntimeEntriesEqual(form, baselineForm);
  }, [form, baselineForm]);

  const onSave = async () => {
    if (!form || !codeBaseline) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const diff = buildElementTypeRuntimeAdminOverrideDiff(codeBaseline, form);
      const res = await fetch("/api/backoffice/cms/element-type-runtime", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(
          Object.keys(diff).length === 0 ? { alias, reset: true } : { alias, override: diff },
        ),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; data?: Payload };
      if (!res.ok || !j?.ok) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      if (j.data?.merged?.[alias]) {
        const next = structuredClone(j.data.merged[alias]) as ElementTypeRuntimeMergedEntry;
        setForm(next);
        setBaselineForm(structuredClone(next));
        setPayload(j.data);
      }
      setSaveMsg("Lagret og publisert til settings.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Lagring feilet");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-600">Laster…</p>;
  if (error || !form || !codeBaseline) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900">{error ?? "Mangler data"}</div>
    );
  }

  return (
    <div
      className="space-y-6"
      data-lp-element-type-workspace={alias}
      data-lp-element-type-alias={alias}
      data-lp-element-type-dirty={dirty ? "true" : "false"}
    >
      <nav className="text-sm text-slate-600">
        <Link href="/backoffice/settings/element-types" className="hover:text-slate-900">
          ← Element types
        </Link>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-slate-500">{alias}</p>
          <h2 className="text-xl font-semibold text-slate-900">Element type workspace (runtime)</h2>
        </div>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void onSave()}
          className="min-h-10 rounded-full border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          data-lp-element-type-save
        >
          {saving ? "Lagrer…" : "Lagre"}
        </button>
      </div>

      {saveMsg ? (
        <p className="text-sm text-slate-700" role="status">
          {saveMsg}
        </p>
      ) : null}

      {payload?.overrides?.byAlias?.[alias] ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-950">
          Aktiv persisted override for denne elementtypen.
        </p>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
        <label className="block text-xs font-medium text-slate-700">
          Tittel (library / inspector)
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm((p) => (p ? { ...p, title: e.target.value } : p))}
            data-lp-element-type-title-input
          />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Kort tittel
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.shortTitle}
            onChange={(e) => setForm((p) => (p ? { ...p, shortTitle: e.target.value } : p))}
            data-lp-element-type-short-title-input
          />
        </label>
        <label className="col-span-full block text-xs font-medium text-slate-700">
          Beskrivelse
          <textarea
            className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm((p) => (p ? { ...p, description: e.target.value } : p))}
            data-lp-element-type-description-input
          />
        </label>
        <label className="col-span-full block text-xs font-medium text-slate-700">
          Editor-hjelp (runtime, library + inspector)
          <textarea
            className="mt-1 min-h-[56px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.editorHelpText}
            onChange={(e) => setForm((p) => (p ? { ...p, editorHelpText: e.target.value } : p))}
            data-lp-element-type-editor-help-input
          />
        </label>
      </section>
    </div>
  );
}
