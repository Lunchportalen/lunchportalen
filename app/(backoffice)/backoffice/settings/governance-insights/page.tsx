"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { backofficeEntityActionPrimaryClass } from "@/components/backoffice/backofficeEntityActionStyles";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";

const BATCH_MAX = 25;

type GovernanceUsagePayload = {
  scannedVariants: number;
  totalVariantsInDb: number | null;
  scanCapped: boolean;
  maxScan?: number;
  governedVariants: number;
  legacyVariants: number;
  governedAllowlistOk: number;
  governedAllowlistFail: number;
  invalidDocumentTypeVariants: number;
  byDocumentType: Record<string, number>;
  blockTypeCounts: Record<string, number>;
  legacyPageIds: string[];
  legacyPageIdSampleCap: number;
};

type BatchResultPayload = {
  dryRun: boolean;
  documentTypeAlias: string;
  locale: string;
  environment: string;
  maxBatch: number;
  results: Array<
    | { pageId: string; status: "preview_ok" }
    | { pageId: string; status: "skipped"; reason: string }
    | { pageId: string; status: "applied" }
    | { pageId: string; status: "error"; reason: string }
  >;
};

/**
 * U27/U28/U33 — Management-innsikt + eksplisitt batch-normalisering (superadmin).
 */
export default function GovernanceInsightsPage() {
  const [data, setData] = useState<GovernanceUsagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedLegacy, setSelectedLegacy] = useState<Set<string>>(() => new Set());
  const [docAlias, setDocAlias] = useState("page");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResultPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch("/api/backoffice/content/governance-usage", { credentials: "include" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          message?: string;
          data?: GovernanceUsagePayload;
        } | null;
        if (cancelled) return;
        if (!res.ok || json?.ok === false) {
          setError(typeof json?.message === "string" ? json.message : `HTTP ${res.status}`);
          setData(null);
          return;
        }
        setError(null);
        setData(json?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Nettverksfeil");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLegacy = useCallback((id: string, on: boolean) => {
    setSelectedLegacy((prev) => {
      const n = new Set(prev);
      if (on) {
        if (n.size >= BATCH_MAX && !n.has(id)) return prev;
        n.add(id);
      } else n.delete(id);
      return n;
    });
  }, []);

  const selectAllLegacySample = useCallback(() => {
    if (!data?.legacyPageIds.length) return;
    setSelectedLegacy(new Set(data.legacyPageIds.slice(0, BATCH_MAX)));
  }, [data?.legacyPageIds]);

  const runBatch = useCallback(
    async (dryRun: boolean) => {
      setBatchLoading(true);
      setBatchError(null);
      setBatchResult(null);
      const pageIds = [...selectedLegacy];
      if (pageIds.length === 0) {
        setBatchError("Velg minst én side.");
        setBatchLoading(false);
        return;
      }
      if (!dryRun) {
        const ok = window.confirm(
          `Utfør normalisering for ${pageIds.length} side(r) mot dokumenttype «${docAlias.trim() || "page"}»? Dette skriver til databasen (nb/prod).`
        );
        if (!ok) {
          setBatchLoading(false);
          return;
        }
      }
      try {
        const res = await fetch("/api/backoffice/content/batch-normalize-legacy", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageIds,
            documentTypeAlias: docAlias.trim() || "page",
            dryRun,
            locale: "nb",
            environment: "prod",
          }),
        });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          message?: string;
          data?: BatchResultPayload;
        } | null;
        if (!res.ok || json?.ok === false) {
          setBatchError(typeof json?.message === "string" ? json.message : `HTTP ${res.status}`);
          return;
        }
        setBatchResult(json?.data ?? null);
      } catch {
        setBatchError("Nettverksfeil");
      } finally {
        setBatchLoading(false);
      }
    },
    [docAlias, selectedLegacy]
  );

  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "governance-insights",
    title: "Governance og bruk",
    description:
      "Runtime-read management workspace for envelope-dekning, allowlist-status, legacy-varianter og eksplisitt batch-normalisering.",
    routeKind: "workspace",
    signals: [
      {
        label: "Skannet",
        value: loading ? "Laster" : String(data?.scannedVariants ?? 0),
        description: "Antall skannede varianter i denne kjøringen.",
      },
      {
        label: "Legacy",
        value: loading ? "Laster" : String(data?.legacyVariants ?? 0),
        description: "Varianter uten documentType etter parseBodyEnvelope.",
      },
      {
        label: "Allowlist-brudd",
        value: loading ? "Laster" : String(data?.governedAllowlistFail ?? 0),
        tone: (data?.governedAllowlistFail ?? 0) > 0 ? "warning" : "success",
        description: "Govert innhold med blokktyper utenfor dokumenttypens allowlist.",
      },
    ],
    primaryAction: {
      label: "Åpne create policy",
      href: "/backoffice/settings/create-policy",
      look: "primary",
    },
    secondaryActions: [
      { label: "Document types", href: "/backoffice/settings/document-types", look: "secondary" },
      { label: "Schema og presets", href: "/backoffice/settings/schema", look: "outline" },
    ],
    relatedLinks: [
      { label: "Management read", href: "/backoffice/settings/management-read", look: "outline" },
      { label: "Content", href: "/backoffice/content", look: "outline" },
    ],
    note:
      "Analyse er runtime-read. Batch-normalisering er eksplisitt, superadmin-gated og bruker samme trygge transform som editoren.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div className="max-w-4xl space-y-8">
      {loading ? (
        <p className="text-sm text-slate-600">Laster…</p>
      ) : error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
          {error}
          {error.includes("403") || error.toLowerCase().includes("tilgang") ? (
            <span className="mt-1 block">Krever superadmin.</span>
          ) : null}
        </div>
      ) : data ? (
        <>
          {data.scanCapped ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              Skanning er begrenset (maks {data.maxScan ?? "?"} varianter).
              {data.totalVariantsInDb != null ? ` Totalt i DB: ${data.totalVariantsInDb}.` : ""} Tall kan være
              delvis — bruk som operativ indikator, ikke som revisjonsgrunnlag alene.
            </p>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Envelope (governed)</h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{data.governedVariants}</p>
              <p className="text-xs text-slate-600">varianter med ikke-tom documentType</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Legacy / flat</h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{data.legacyVariants}</p>
              <p className="text-xs text-slate-600">varianter uten documentType (etter parseBodyEnvelope)</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Allowlist OK (governed)</h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-800">{data.governedAllowlistOk}</p>
              <p className="text-xs text-slate-600">varianter der blokktyper er innenfor dokumenttype</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Allowlist-brudd</h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-900">{data.governedAllowlistFail}</p>
              <p className="text-xs text-slate-600">governed med forbudte blokktyper</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Ukjent dokumenttype</h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-red-900">{data.invalidDocumentTypeVariants}</p>
              <p className="text-xs text-slate-600">documentType finnes ikke i register</p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Dokumenttyper (varianter)</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {Object.keys(data.byDocumentType).length === 0 ? (
                <li className="text-slate-600">Ingen governed varianter i skannet sett.</li>
              ) : (
                Object.entries(data.byDocumentType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                      <code className="text-xs text-slate-800">{k}</code>
                      <span className="tabular-nums text-slate-700">{v}</span>
                    </li>
                  ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Blokktyper (forekomster i kropp)</h2>
            <p className="mt-1 text-xs text-slate-600">
              Aggregert fra extractBlockTypeKeysFromBodyPayload — samme kilde som allowlist-governance ved lagring.
            </p>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
              {Object.keys(data.blockTypeCounts).length === 0 ? (
                <li className="text-slate-600">Ingen blokktyper funnet.</li>
              ) : (
                Object.entries(data.blockTypeCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                      <code className="text-xs text-slate-800">{k}</code>
                      <span className="tabular-nums text-slate-700">{v}</span>
                    </li>
                  ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Legacy review og batch">
            <h2 className="text-sm font-semibold text-slate-900">Legacy-sider (utvalg) og batch-normalisering</h2>
            <p className="mt-1 text-xs text-slate-600">
              Unike side-IDer med minst én legacy-variant (begrenset til {data.legacyPageIdSampleCap}). Velg opptil{" "}
              {BATCH_MAX}, sett dokumenttype-alias (må finnes i register), kjør forhåndsvisning deretter skriv. Ingen
              skjulte mutasjoner utføres uten eksplisitt operatorhandling.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-slate-700">Dokumenttype-alias</span>
                <input
                  type="text"
                  value={docAlias}
                  onChange={(e) => setDocAlias(e.target.value)}
                  className="rounded border border-slate-200 px-2 py-1 text-sm"
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                onClick={selectAllLegacySample}
                disabled={!data.legacyPageIds.length}
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Velg første {Math.min(BATCH_MAX, data.legacyPageIds.length)} i listen
              </button>
            </div>
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
              {data.legacyPageIds.length === 0 ? (
                <li className="text-slate-600">Ingen legacy i utvalget.</li>
              ) : (
                data.legacyPageIds.map((id) => {
                  const checked = selectedLegacy.has(id);
                  return (
                    <li key={id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                      <label className="flex min-h-11 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleLegacy(id, e.target.checked)}
                          className="h-5 w-5 accent-pink-600"
                          disabled={!checked && selectedLegacy.size >= BATCH_MAX}
                        />
                        <code className="text-xs text-slate-800">{id}</code>
                      </label>
                      <Link
                        href={`/backoffice/content/${encodeURIComponent(id)}`}
                        className={`${backofficeEntityActionPrimaryClass} ml-auto`}
                      >
                        Åpne i redigerer
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={batchLoading || selectedLegacy.size === 0}
                onClick={() => void runBatch(true)}
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                {batchLoading ? "Kjører…" : "Forhåndsvis batch (dry-run)"}
              </button>
              <button
                type="button"
                disabled={batchLoading || selectedLegacy.size === 0}
                onClick={() => void runBatch(false)}
                className="min-h-11 rounded-lg border border-pink-500/40 bg-pink-50 px-4 text-sm font-semibold text-pink-800 underline decoration-pink-400/50 underline-offset-4 hover:bg-pink-100 disabled:opacity-50"
              >
                Utfør normalisering (lagre)
              </button>
            </div>
            {batchError ? (
              <p className="mt-2 text-sm text-red-800" role="alert">
                {batchError}
              </p>
            ) : null}
            {batchResult ? (
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded border border-slate-100 bg-slate-50/80 p-2 text-xs text-slate-800">
                {batchResult.results.map((r) => (
                  <li key={r.pageId}>
                    <span className="font-mono">{r.pageId}</span> — {r.status}
                    {"reason" in r ? `: ${r.reason}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : (
        <p className="text-sm text-slate-600">Ingen data.</p>
      )}

      <p className="text-xs text-slate-500">
        Enkeltoppgradering i workspace følger samme validering. Batch er superadmin-only og stopper ikke hele kjøringen
        ved én feil — se resultatliste.
      </p>
      </div>
    </BackofficeManagementWorkspaceFrame>
  );
}
