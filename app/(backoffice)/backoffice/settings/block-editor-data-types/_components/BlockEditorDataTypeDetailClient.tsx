"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EDITOR_BLOCK_CREATE_OPTIONS } from "@/lib/cms/editorBlockCreateOptions";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import { getBlockEditorDataType } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { BlockEditorDataTypeOverridesFile } from "@/lib/cms/blocks/blockEditorDataTypeMerge";
import type { BlockEditorDataTypeReference } from "@/lib/cms/blocks/blockEditorDataTypeReferences";
import {
  buildBlockEditorDataTypeAdminOverrideDiff,
  cloneBlockEditorDataTypeDefinition,
  definitionsEqual,
} from "@/lib/cms/blocks/blockEditorDataTypeWorkspaceModel";

type Payload = {
  merged: Record<string, BlockEditorDataTypeDefinition>;
  overrides: BlockEditorDataTypeOverridesFile;
  referencesByAlias: Record<string, BlockEditorDataTypeReference[]>;
  aliases: string[];
};

const BLOCK_OPTIONS = [...EDITOR_BLOCK_CREATE_OPTIONS].sort((a, b) => a.label.localeCompare(b.label, "nb"));

export function BlockEditorDataTypeDetailClient({ alias }: { alias: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [form, setForm] = useState<BlockEditorDataTypeDefinition | null>(null);
  const [baselineForm, setBaselineForm] = useState<BlockEditorDataTypeDefinition | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/backoffice/cms/block-editor-data-types", {
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
      if (!merged) {
        throw new Error("Ukjent data type.");
      }
      const cloned = cloneBlockEditorDataTypeDefinition(merged);
      setForm(cloned);
      setBaselineForm(cloneBlockEditorDataTypeDefinition(merged));
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

  const codeBaseline = useMemo(() => getBlockEditorDataType(alias), [alias]);

  const dirty = useMemo(() => {
    if (!form || !baselineForm) return false;
    return !definitionsEqual(form, baselineForm);
  }, [form, baselineForm]);

  const references = payload?.referencesByAlias[alias] ?? [];

  const toggleAllowed = (type: string, on: boolean) => {
    setForm((prev) => {
      if (!prev) return prev;
      const set = new Set(prev.allowedBlockAliases.map(String));
      if (on) set.add(type);
      else set.delete(type);
      const nextAllowed = [...set];
      const nextGroups = prev.groups.map((g) => ({
        ...g,
        blockAliases: g.blockAliases.filter((t) => nextAllowed.includes(String(t))),
      }));
      return { ...prev, allowedBlockAliases: nextAllowed, groups: nextGroups };
    });
  };

  const setGroupTitle = (groupId: string, title: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: prev.groups.map((g) => (g.id === groupId ? { ...g, title } : g)),
      };
    });
  };

  const toggleGroupBlock = (groupId: string, type: string, on: boolean) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: prev.groups.map((g) => {
          if (g.id !== groupId) return g;
          const cur = new Set(g.blockAliases.map(String));
          if (on) cur.add(type);
          else cur.delete(type);
          return { ...g, blockAliases: [...cur] };
        }),
      };
    });
  };

  const onSave = async () => {
    if (!form || !codeBaseline) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const diff = buildBlockEditorDataTypeAdminOverrideDiff(codeBaseline, form);
      const res = await fetch("/api/backoffice/cms/block-editor-data-types", {
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
        const next = cloneBlockEditorDataTypeDefinition(j.data.merged[alias]);
        setForm(next);
        setBaselineForm(cloneBlockEditorDataTypeDefinition(j.data.merged[alias]));
        setPayload(j.data);
      }
      setSaveMsg("Lagret og publisert til settings.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Lagring feilet");
    } finally {
      setSaving(false);
    }
  };

  const onResetBaseline = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/backoffice/cms/block-editor-data-types", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ alias, reset: true }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; data?: Payload };
      if (!res.ok || !j?.ok) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      if (j.data?.merged?.[alias]) {
        const next = cloneBlockEditorDataTypeDefinition(j.data.merged[alias]);
        setForm(next);
        setBaselineForm(cloneBlockEditorDataTypeDefinition(j.data.merged[alias]));
        setPayload(j.data);
      }
      setSaveMsg("Tilbakestilt til kode-baseline.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Feilet");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Laster…</p>;
  }
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
      data-lp-data-type-workspace={alias}
      data-lp-data-type-alias={alias}
      data-lp-data-type-dirty={dirty ? "true" : "false"}
    >
      <nav className="text-sm text-slate-600">
        <Link href="/backoffice/settings/block-editor-data-types" className="hover:text-slate-900">
          ← Block Editor Data Types
        </Link>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-slate-500">{alias}</p>
          <h2 className="text-xl font-semibold text-slate-900">{form.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-950">
              Ulagrede endringer
            </span>
          ) : (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
              I sync med lagret
            </span>
          )}
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void onSave()}
            className="min-h-10 rounded-full border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            data-lp-data-type-save
          >
            {saving ? "Lagrer…" : "Lagre"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onResetBaseline()}
            className="min-h-10 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Tilbakestill til kode-baseline
          </button>
        </div>
      </div>

      {saveMsg ? (
        <p className="text-sm text-slate-700" role="status">
          {saveMsg}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Referanser (document types)</h3>
        {references.length > 0 ? (
          <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
            {references.map((r) => (
              <li key={r.documentTypeAlias}>
                <Link
                  href={`/backoffice/settings/document-types/${encodeURIComponent(r.documentTypeAlias)}`}
                  className="font-medium text-slate-900 underline underline-offset-4"
                >
                  {r.documentTypeName}
                </Link>{" "}
                <span className="text-slate-500">
                  ({r.propertyKey})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Ingen dokumenttype bruker denne data typen.</p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Tekst og grenser</h3>
          <label className="block text-xs font-medium text-slate-700">
            Tittel
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((p) => (p ? { ...p, title: e.target.value } : p))}
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Beskrivelse
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm((p) => (p ? { ...p, description: e.target.value } : p))}
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Create-knapp (label)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.createButtonLabel}
              onChange={(e) => setForm((p) => (p ? { ...p, createButtonLabel: e.target.value } : p))}
              data-lp-data-type-create-label-input
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-700">
              Min items
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.minItems}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, minItems: Math.max(0, Number(e.target.value) || 0) } : p))
                }
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Maks items
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.maxItems}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, maxItems: Math.max(0, Number(e.target.value) || 0) } : p))
                }
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-700">
            Editor kind
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.editorKind}
              onChange={(e) =>
                setForm((p) =>
                  p
                    ? {
                        ...p,
                        editorKind: e.target.value === "block_grid" ? "block_grid" : "block_list",
                      }
                    : p,
                )
              }
            >
              <option value="block_list">block_list</option>
              <option value="block_grid">block_grid</option>
            </select>
          </label>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Tillatte blokker (allowlist)</h3>
          <p className="text-xs text-slate-600">Kun registrerte editor-blokker kan velges.</p>
          <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {BLOCK_OPTIONS.map((opt) => {
              const on = form.allowedBlockAliases.includes(opt.type);
              return (
                <li key={opt.type} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={on}
                    onChange={(e) => toggleAllowed(opt.type, e.target.checked)}
                    id={`allow-${alias}-${opt.type}`}
                  />
                  <label htmlFor={`allow-${alias}-${opt.type}`} className="cursor-pointer">
                    <span className="font-medium text-slate-900">{opt.label}</span>
                    <span className="ml-2 font-mono text-[11px] text-slate-500">{opt.type}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Grupper i bibliotek</h3>
        <p className="mt-1 text-xs text-slate-600">
          Gruppe-titler og hvilke tillatte blokker som vises under hver seksjon i block library.
        </p>
        <div className="mt-4 grid gap-6">
          {form.groups.map((g) => (
            <div key={g.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
              <label className="block text-xs font-medium text-slate-700">
                Gruppe-ID <span className="font-mono text-slate-500">{g.id}</span> — tittel
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={g.title}
                  onChange={(e) => setGroupTitle(g.id, e.target.value)}
                  data-lp-data-type-group-title={g.id}
                />
              </label>
              <p className="mt-3 text-[11px] font-semibold uppercase text-slate-500">Blokker i gruppen</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {form.allowedBlockAliases.map((typeKey) => {
                  const label = BLOCK_OPTIONS.find((o) => o.type === typeKey)?.label ?? typeKey;
                  const checked = g.blockAliases.map(String).includes(String(typeKey));
                  return (
                    <li key={`${g.id}-${typeKey}`} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={(e) => toggleGroupBlock(g.id, String(typeKey), e.target.checked)}
                        id={`grp-${g.id}-${typeKey}`}
                      />
                      <label htmlFor={`grp-${g.id}-${typeKey}`} className="cursor-pointer text-slate-800">
                        {label}{" "}
                        <span className="font-mono text-[10px] text-slate-500">{typeKey}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
