"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { BlockEditorDataTypeOverridesFile } from "@/lib/cms/blocks/blockEditorDataTypeMerge";
import type { BlockEditorDataTypeReference } from "@/lib/cms/blocks/blockEditorDataTypeReferences";

type Payload = {
  merged: Record<string, BlockEditorDataTypeDefinition>;
  overrides: BlockEditorDataTypeOverridesFile;
  referencesByAlias: Record<string, BlockEditorDataTypeReference[]>;
  aliases: string[];
};

export function BlockEditorDataTypesListClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      setData(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste data types");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-600">Laster Block Editor Data Types…</p>;
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900">
        {error ?? "Ukjent feil"}
        <button type="button" className="ml-3 underline" onClick={() => void load()}>
          Prøv igjen
        </button>
      </div>
    );
  }

  const aliases = data.aliases.length > 0 ? data.aliases : Object.keys(data.merged).sort((a, b) => a.localeCompare(b, "nb"));

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {aliases.map((alias) => {
        const def = data.merged[alias];
        if (!def) return null;
        const refs = data.referencesByAlias[alias] ?? [];
        const hasOverride = Boolean(data.overrides.byAlias?.[alias]);
        const href = `/backoffice/settings/block-editor-data-types/${encodeURIComponent(alias)}`;
        return (
          <li key={alias} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] text-slate-500">{alias}</p>
                <h2 className="text-lg font-semibold text-slate-900">{def.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{def.description}</p>
              </div>
              <Link
                href={href}
                className="min-h-10 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Åpne
              </Link>
            </div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <dt className="text-[11px] font-semibold uppercase text-slate-500">Tillatte blokker</dt>
                <dd className="mt-1 text-slate-900">{def.allowedBlockAliases.length}</dd>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <dt className="text-[11px] font-semibold uppercase text-slate-500">Min / maks</dt>
                <dd className="mt-1 text-slate-900">
                  {def.minItems} / {def.maxItems}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <dt className="text-[11px] font-semibold uppercase text-slate-500">Admin-overstyring</dt>
                <dd className="mt-1 text-slate-900">{hasOverride ? "Ja" : "Nei (baseline)"}</dd>
              </div>
            </dl>
            {refs.length > 0 ? (
              <p className="mt-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Brukes av:</span>{" "}
                {refs.map((r) => r.documentTypeName).join(", ")}
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Ingen dokumenttype peker på denne data typen.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
