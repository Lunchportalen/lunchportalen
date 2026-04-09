"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CompositionDefinition } from "@/lib/cms/schema/compositionDefinitions";
import {
  buildCompositionAdminOverrideDiff,
  cloneCompositionForForm,
  definitionsEqualComposition,
  type CompositionDefinitionsMergedPayload,
} from "@/lib/cms/schema/compositionDefinitionMerge";
import { listBlockEditorDataTypeAliases } from "@/lib/cms/blocks/blockEditorDataTypes";
import { listDocumentTypeAliases } from "@/lib/cms/schema/documentTypeDefinitions";

type Payload = CompositionDefinitionsMergedPayload;

export function CompositionWorkspaceClient({ alias }: { alias: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [form, setForm] = useState<CompositionDefinition | null>(null);
  const [baselineForm, setBaselineForm] = useState<CompositionDefinition | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/backoffice/cms/composition-definitions", {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; data?: Payload };
      if (!res.ok || !j?.ok || !j.data?.merged?.[alias]) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      const merged = structuredClone(j.data.merged[alias]) as CompositionDefinition;
      setPayload(j.data);
      setForm(merged);
      setBaselineForm(structuredClone(merged) as CompositionDefinition);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste");
    } finally {
      setLoading(false);
    }
  }, [alias]);

  useEffect(() => {
    void load();
  }, [load]);

  const codeBaseline = useMemo(() => cloneCompositionForForm(alias), [alias]);
  const dirty = useMemo(() => {
    if (!form || !baselineForm) return false;
    return !definitionsEqualComposition(form, baselineForm);
  }, [form, baselineForm]);

  const onSave = async () => {
    if (!form || !codeBaseline) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const diff = buildCompositionAdminOverrideDiff(codeBaseline, form);
      const res = await fetch("/api/backoffice/cms/composition-definitions", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(Object.keys(diff).length === 0 ? { alias, reset: true } : { alias, override: diff }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; data?: Payload };
      if (!res.ok || !j?.ok || !j.data?.merged?.[alias]) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      const merged = structuredClone(j.data.merged[alias]) as CompositionDefinition;
      setPayload(j.data);
      setForm(merged);
      setBaselineForm(structuredClone(merged) as CompositionDefinition);
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
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900">
        {error ?? "Mangler data"}
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      data-lp-composition-workspace={alias}
      data-lp-composition-dirty={dirty ? "true" : "false"}
    >
      <nav className="text-sm text-slate-600">
        <Link href="/backoffice/settings/compositions" className="hover:text-slate-900">
          ← Compositions
        </Link>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-slate-500">{alias}</p>
          <h1 className="text-xl font-semibold text-slate-900">Composition workspace</h1>
        </div>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void onSave()}
          className="min-h-10 rounded-full border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          data-lp-composition-save
        >
          {saving ? "Lagrer…" : "Lagre"}
        </button>
      </div>

      {saveMsg ? (
        <p className="text-sm text-slate-700" role="status">
          {saveMsg}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Metadata</h2>
          <label className="block text-xs font-medium text-slate-700">
            Tittel
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((p) => (p ? { ...p, title: e.target.value } : p))}
              data-lp-composition-title-input
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Beskrivelse
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm((p) => (p ? { ...p, description: e.target.value } : p))}
              data-lp-composition-description-input
            />
          </label>
        </div>
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Allowed document types</h2>
          <div className="flex flex-wrap gap-2">
            {listDocumentTypeAliases().map((docAlias) => {
              const selected = form.allowedDocumentTypeAliases.includes(docAlias);
              return (
                <span
                  key={docAlias}
                  className={`rounded-full border px-3 py-1 font-mono text-xs ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                >
                  {docAlias}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">Allowed-listen er baseline-styrt og vises her som referanse.</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Grupper (tabs)</h2>
        <div className="mt-3 grid gap-3">
          {form.groups.map((g) => (
            <label key={g.id} className="block text-xs font-medium text-slate-700">
              Gruppe <span className="font-mono">{g.id}</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={g.title}
                onChange={(e) =>
                  setForm((p) =>
                    p ? { ...p, groups: p.groups.map((x) => (x.id === g.id ? { ...x, title: e.target.value } : x)) } : p,
                  )
                }
                data-lp-composition-group-title={g.id}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Properties</h2>
        <div className="mt-3 grid gap-4">
          {form.properties.map((prop) => (
            <article key={prop.alias} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="font-mono text-xs text-slate-600">{prop.alias}</p>
              <label className="mt-2 block text-xs font-medium text-slate-700">
                Tittel
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={prop.title}
                  onChange={(e) =>
                    setForm((p) =>
                      p
                        ? {
                            ...p,
                            properties: p.properties.map((x) =>
                              x.alias === prop.alias ? { ...x, title: e.target.value } : x,
                            ),
                          }
                        : p,
                    )
                  }
                  data-lp-composition-property-title={prop.alias}
                />
              </label>
              <label className="mt-2 block text-xs font-medium text-slate-700">
                Beskrivelse
                <textarea
                  className="mt-1 min-h-[56px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={prop.description ?? ""}
                  onChange={(e) =>
                    setForm((p) =>
                      p
                        ? {
                            ...p,
                            properties: p.properties.map((x) =>
                              x.alias === prop.alias ? { ...x, description: e.target.value } : x,
                            ),
                          }
                        : p,
                    )
                  }
                  data-lp-composition-property-description={prop.alias}
                />
              </label>
              <label className="mt-2 block text-xs font-medium text-slate-700">
                Data type
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                  value={prop.dataTypeAlias}
                  onChange={(e) =>
                    setForm((p) =>
                      p
                        ? {
                            ...p,
                            properties: p.properties.map((x) =>
                              x.alias === prop.alias ? { ...x, dataTypeAlias: e.target.value } : x,
                            ),
                          }
                        : p,
                    )
                  }
                  data-lp-composition-property-data-type={prop.alias}
                >
                  {listBlockEditorDataTypeAliases()
                    .concat(["cms_text_line", "cms_text_area"])
                    .map((dataTypeAlias) => (
                      <option key={dataTypeAlias} value={dataTypeAlias}>
                        {dataTypeAlias}
                      </option>
                    ))}
                </select>
              </label>
            </article>
          ))}
        </div>
      </section>

      {payload?.overrides?.byAlias?.[alias] ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-950">
          Aktiv persisted override finnes for denne composition.
        </section>
      ) : null}
    </div>
  );
}
