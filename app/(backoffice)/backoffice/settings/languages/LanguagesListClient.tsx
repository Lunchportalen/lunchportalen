"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LanguageDefinition } from "@/lib/cms/schema/languageDefinitions";

type Payload = {
  ok?: boolean;
  data?: { merged: Record<string, LanguageDefinition>; aliases?: string[] };
  message?: string;
};

export function LanguagesListClient() {
  const [merged, setMerged] = useState<Record<string, LanguageDefinition> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/cms/language-definitions", {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const j = (await res.json()) as Payload;
      if (!res.ok || !j?.ok || !j.data?.merged) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      setMerged(j.data.merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste språk");
      setMerged(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-slate-600">Laster…</p>;
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900" data-lp-languages-error>
        {error}
      </div>
    );
  }
  if (!merged) return null;

  const list = Object.values(merged).sort((a, b) => a.alias.localeCompare(b.alias));

  return (
    <ul
      className="grid gap-3 sm:grid-cols-2"
      data-lp-languages-overview="true"
    >
      {list.map((lang) => (
        <li key={lang.alias}>
          <Link
            href={`/backoffice/settings/languages/workspace/${encodeURIComponent(lang.alias)}`}
            className="lp-motion-card flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
            data-lp-language-alias={lang.alias}
            data-lp-language-title={lang.title}
            data-lp-language-default={lang.isDefault ? "true" : "false"}
            data-lp-language-culture={lang.cultureCode}
          >
            <span className="font-mono text-[11px] text-slate-500">{lang.alias}</span>
            <span className="mt-1 text-base font-semibold text-slate-900">{lang.title}</span>
            <span className="mt-1 text-xs text-slate-600">{lang.cultureCode}</span>
            <span className="mt-2 text-[11px] font-medium text-slate-500">
              {lang.enabled ? "Aktiv" : "Deaktivert"}
              {lang.isDefault ? " · Default" : ""}
              {lang.isMandatory ? " · Obligatorisk" : ""}
            </span>
            <span className="mt-3 text-sm font-semibold text-pink-700">Åpne workspace →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
