"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentTypeDefinition, PropertyVariation } from "@/lib/cms/schema/documentTypeDefinitions";
import {
  buildDocumentTypeAdminOverrideDiff,
  cloneDocumentTypeForForm,
  definitionsEqual,
  type DocumentTypeDefinitionsMergedPayload,
} from "@/lib/cms/schema/documentTypeDefinitionMerge";
import { listBlockEditorDataTypeAliases } from "@/lib/cms/blocks/blockEditorDataTypes";
import { getBaselineCompositionDefinition } from "@/lib/cms/schema/compositionDefinitions";
import { listDocumentTypeAliases } from "@/lib/cms/schema/documentTypeDefinitions";
import { SEMANTIC_ICON_KEYS } from "@/lib/iconRegistry";

type Payload = DocumentTypeDefinitionsMergedPayload;

export function DocumentTypeWorkspaceClient({ alias }: { alias: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [catalog, setCatalog] = useState<{ compositionAliases: string[]; templateAliases: string[] }>({
    compositionAliases: [],
    templateAliases: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentTypeDefinition | null>(null);
  const [baselineForm, setBaselineForm] = useState<DocumentTypeDefinition | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/backoffice/cms/document-type-definitions", {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; data?: Payload };
      if (!res.ok || !j?.ok || !j.data?.mergedCore) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      setPayload(j.data);
      const core = j.data.mergedCore[alias];
      if (!core) throw new Error("Ukjent dokumenttype.");
      const cloned = structuredClone(core) as DocumentTypeDefinition;
      setForm(cloned);
      setBaselineForm(structuredClone(core) as DocumentTypeDefinition);
      setCatalog({
        compositionAliases: Array.isArray(j.data.compositionAliases) ? j.data.compositionAliases : [],
        templateAliases: Array.isArray(j.data.templateAliases) ? j.data.templateAliases : [],
      });
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

  const codeBaseline = useMemo(() => cloneDocumentTypeForForm(alias), [alias]);

  const dirty = useMemo(() => {
    if (!form || !baselineForm) return false;
    return !definitionsEqual(form, baselineForm);
  }, [form, baselineForm]);

  const onSave = async () => {
    if (!form || !codeBaseline) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const diff = buildDocumentTypeAdminOverrideDiff(codeBaseline, form);
      const res = await fetch("/api/backoffice/cms/document-type-definitions", {
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
      if (j.data?.mergedCore?.[alias]) {
        const next = structuredClone(j.data.mergedCore[alias]) as DocumentTypeDefinition;
        setForm(next);
        setBaselineForm(structuredClone(next) as DocumentTypeDefinition);
        setPayload(j.data);
      }
      setSaveMsg("Lagret og publisert til settings.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Lagring feilet");
    } finally {
      setSaving(false);
    }
  };

  const dtAliases = listBlockEditorDataTypeAliases();

  const childDocCandidates = useMemo(() => listDocumentTypeAliases().filter((a) => a !== alias), [alias]);
  const compositionCandidates = useMemo(
    () =>
      catalog.compositionAliases.filter((c) => {
        const def = getBaselineCompositionDefinition(c);
        return def?.allowedDocumentTypeAliases.includes(alias);
      }),
    [catalog.compositionAliases, alias],
  );

  if (loading) return <p className="text-sm text-slate-600">Laster…</p>;
  if (error || !form || !codeBaseline) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900">{error ?? "Mangler data"}</div>
    );
  }

  const bodyProp = form.properties.find((p) => p.alias === "body");

  return (
    <div
      className="space-y-6"
      data-lp-document-type-workspace={alias}
      data-lp-document-type-alias={alias}
      data-lp-document-type-dirty={dirty ? "true" : "false"}
    >
      <nav className="text-sm text-slate-600">
        <Link href="/backoffice/settings/document-types" className="hover:text-slate-900">
          ← Document types
        </Link>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-slate-500">{alias}</p>
          <h1 className="text-xl font-semibold text-slate-900">Document type workspace</h1>
        </div>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void onSave()}
          className="min-h-10 rounded-full border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          data-lp-document-type-save
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
          <h2 className="text-sm font-semibold text-slate-900">Dokumenttype</h2>
          <label className="block text-xs font-medium text-slate-700">
            Tittel
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((p) => (p ? { ...p, title: e.target.value } : p))}
              data-lp-document-type-title-input
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Beskrivelse
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm((p) => (p ? { ...p, description: e.target.value } : p))}
              data-lp-document-type-description-input
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Ikon (semantic key)
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.icon}
              onChange={(e) =>
                setForm((p) => (p ? { ...p, icon: e.target.value as DocumentTypeDefinition["icon"] } : p))
              }
            >
              {SEMANTIC_ICON_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Grupper (tabs)</h2>
          {form.groups.map((g) => (
            <label key={g.id} className="block text-xs font-medium text-slate-700">
              Gruppe <span className="font-mono">{g.id}</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={g.title}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          groups: p.groups.map((x) => (x.id === g.id ? { ...x, title: e.target.value } : x)),
                        }
                      : p,
                  )
                }
                data-lp-document-type-group-title={g.id}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Property types → Data types</h2>
        {bodyProp ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">
              Property <span className="font-mono">{bodyProp.alias}</span> · gruppe{" "}
              <span className="font-mono">{bodyProp.groupId}</span>
            </p>
            <label className="block text-xs font-medium text-slate-700">
              Property-tittel (vises i editoren)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={bodyProp.title}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          properties: p.properties.map((x) =>
                            x.alias === "body" ? { ...x, title: e.target.value } : x,
                          ),
                        }
                      : p,
                  )
                }
                data-lp-document-type-property-body-title
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Property-beskrivelse
              <textarea
                className="mt-1 min-h-[56px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={bodyProp.description ?? ""}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          properties: p.properties.map((x) =>
                            x.alias === "body" ? { ...x, description: e.target.value } : x,
                          ),
                        }
                      : p,
                  )
                }
                data-lp-document-type-property-body-description
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Data type (block editor)
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-xs"
                value={bodyProp.dataTypeAlias}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          properties: p.properties.map((x) =>
                            x.alias === "body" ? { ...x, dataTypeAlias: e.target.value } : x,
                          ),
                        }
                      : p,
                  )
                }
                data-lp-document-type-property-body-data-type
              >
                {dtAliases.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Ingen body-property funnet.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" data-lp-document-type-structure>
        <h2 className="text-sm font-semibold text-slate-900">Struktur / innholdstre</h2>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={form.allowAtRoot}
            onChange={(e) => setForm((p) => (p ? { ...p, allowAtRoot: e.target.checked } : p))}
            data-lp-document-type-allow-root
          />
          Tillat opprettelse i rot (uten forelder)
        </label>
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-slate-700">Tillatte barn-Document Types</p>
          <div className="flex flex-wrap gap-3">
            {childDocCandidates.map((child) => (
              <label key={child} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={form.allowedChildTypes.includes(child)}
                  onChange={() => {
                    setForm((p) => {
                      if (!p) return p;
                      const has = p.allowedChildTypes.includes(child);
                      return {
                        ...p,
                        allowedChildTypes: has
                          ? p.allowedChildTypes.filter((x) => x !== child)
                          : [...p.allowedChildTypes, child],
                      };
                    });
                  }}
                  data-lp-document-type-allowed-child={child}
                />
                <span className="font-mono text-xs">{child}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={Boolean(form.isCollection)}
            onChange={(e) => setForm((p) => (p ? { ...p, isCollection: e.target.checked } : p))}
            data-lp-document-type-is-collection
          />
          Liste-/container-modus (policy-hint)
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" data-lp-document-type-compositions-bound>
        <h2 className="text-sm font-semibold text-slate-900">Compositions (gjenbruk)</h2>
        <p className="mt-1 text-xs text-slate-600">
          Velg hvilke compositions som injiserer delte grupper og felter i denne dokumenttypen.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {compositionCandidates.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.compositionAliases.includes(c)}
                onChange={() => {
                  setForm((p) => {
                    if (!p) return p;
                    const has = p.compositionAliases.includes(c);
                    return {
                      ...p,
                      compositionAliases: has
                        ? p.compositionAliases.filter((x) => x !== c)
                        : [...p.compositionAliases, c],
                    };
                  });
                }}
                data-lp-document-type-composition={c}
              />
              <span className="font-mono text-xs">{c}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" data-lp-document-type-templates-bound>
        <h2 className="text-sm font-semibold text-slate-900">Maler / rendering-binding</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {catalog.templateAliases.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.templates.includes(t)}
                onChange={() => {
                  setForm((p) => {
                    if (!p) return p;
                    const has = p.templates.includes(t);
                    const nextTemplates = has ? p.templates.filter((x) => x !== t) : [...p.templates, t];
                    let nextDefault = p.defaultTemplate;
                    if (has && p.defaultTemplate === t) {
                      nextDefault = nextTemplates[0] ?? null;
                    }
                    return { ...p, templates: nextTemplates, defaultTemplate: nextDefault };
                  });
                }}
                data-lp-document-type-template-option={t}
              />
              <span className="font-mono text-xs">{t}</span>
            </label>
          ))}
        </div>
        <label className="mt-4 block text-xs font-medium text-slate-700">
          Standardmal
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            value={form.defaultTemplate ?? ""}
            onChange={(e) =>
              setForm((p) =>
                p
                  ? {
                      ...p,
                      defaultTemplate: e.target.value.trim() === "" ? null : e.target.value.trim(),
                    }
                  : p,
              )
            }
            data-lp-document-type-default-template
          >
            <option value="">—</option>
            {form.templates.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        data-lp-document-type-property-variation-section
      >
        <h2 className="text-sm font-semibold text-slate-900">Properties · variation (U98)</h2>
        <p className="mt-1 text-xs text-slate-600">
          Invariant deles på tvers av språk; culture lagres per variant-rad (nb/en).
        </p>
        <ul className="mt-4 space-y-3">
          {form.properties.map((prop) => {
            const v: PropertyVariation = prop.variation === "invariant" ? "invariant" : "culture";
            return (
              <li
                key={prop.alias}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                data-lp-property-alias={prop.alias}
                data-lp-property-variation={v}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] text-slate-500">{prop.alias}</p>
                    <p className="text-sm font-medium text-slate-900">{prop.title}</p>
                    <p className="text-[10px] text-slate-500">Data type: {prop.dataTypeAlias}</p>
                  </div>
                  <label className="text-xs font-medium text-slate-700">
                    Variation
                    <select
                      className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-mono"
                      value={v}
                      onChange={(e) => {
                        const next = e.target.value === "invariant" ? "invariant" : "culture";
                        setForm((p) =>
                          p
                            ? {
                                ...p,
                                properties: p.properties.map((x) =>
                                  x.alias === prop.alias ? { ...x, variation: next } : x,
                                ),
                              }
                            : p,
                        );
                      }}
                      data-lp-property-variation-select={prop.alias}
                    >
                      <option value="invariant">invariant</option>
                      <option value="culture">culture</option>
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {payload?.overrides?.byAlias?.[alias] ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-950">
          Aktiv persisted override finnes for denne dokumenttypen (se settings JSON / GET API).
        </section>
      ) : null}
    </div>
  );
}
