"use client";

/**
 * Unified AI assistant: one place for quality score, one run action, one suggestion list, one apply path.
 * Merges SEO and CRO recommendations so the editor has a single decision layer.
 */

import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";

export type UnifiedAiSuggestion = {
  id: string;
  source: "seo" | "cro";
  label: string;
  rationale?: string;
  before?: string;
  suggested: string;
  status: "pending" | "applied" | "dismissed";
};

export type EditorAiUnifiedSuggestionsProps = {
  seoScore?: number | null;
  croScore?: number | null;
  /** Unified score (computed from SEO + CRO) 0–100. */
  aiContentScore?: number | null;
  /** Editor-AI health indicators (derived from existing probes). */
  mediaHealthStatus?: "idle" | "checking" | "available" | "unavailable";
  contentHealthStatus?: "idle" | "checking" | "available" | "unavailable";
  /** AI capability availability. */
  aiCapabilityStatus?: "loading" | "available" | "unavailable";
  /** Short "last analysed" text from the last editor AI run. */
  lastAnalyzedSummary?: string | null;
  suggestions: UnifiedAiSuggestion[];
  onRunAnalysis: () => void;
  runAnalysisBusy?: boolean;
  onApply: (id: string, source: "seo" | "cro") => void;
  onDismiss: (id: string, source: "seo" | "cro") => void;
  disabled?: boolean;
  /** UI-only editor focus (page + section + selected block). */
  contextLabel?: string | null;
  /**
   * AI actions (run tools) slot. Rendered inside the same guided "AI-assistent" panel.
   * Keeps existing ContentAiTools behavior; this is only layout/UX composition.
   */
  aiActions?: ReactNode;
};

export function EditorAiUnifiedSuggestions({
  seoScore,
  croScore,
  aiContentScore = null,
  mediaHealthStatus = "idle",
  contentHealthStatus = "idle",
  aiCapabilityStatus = "loading",
  lastAnalyzedSummary = null,
  suggestions,
  onRunAnalysis,
  runAnalysisBusy = false,
  onApply,
  onDismiss,
  disabled = false,
  contextLabel = null,
  aiActions,
}: EditorAiUnifiedSuggestionsProps) {
  const pending = suggestions.filter((s) => s.status === "pending");
  // Guided workflow: show top recommendations first (max 5).
  const topPending = pending.slice(0, 5);
  const attentionItem = topPending[0] ?? null;
  const hasScores = typeof seoScore === "number" || typeof croScore === "number";
  const statusLabel = disabled
    ? "AI er ikke tilgjengelig"
    : runAnalysisBusy
      ? "Kjører sideanalyse…"
      : hasScores
        ? "Klar for forbedringer"
        : "Venter på analyse";

  const seoPending = topPending.filter((s) => s.source === "seo");
  const croPending = topPending.filter((s) => s.source === "cro");

  const suggestionHaystack = (s: UnifiedAiSuggestion) =>
    `${s.label} ${s.rationale ?? ""} ${s.before ?? ""} ${s.suggested}`.toLowerCase();
  const matchAny = (s: UnifiedAiSuggestion, keywords: string[]) =>
    keywords.some((k) => suggestionHaystack(s).includes(k));

  // Category heuristics (UI-only). If no suggestion matches a bucket, we show a safe placeholder card.
  const seoTitleMetaPending = seoPending.filter((s) =>
    matchAny(s, ["tittel", "meta", "metabeskrivelse", "beskrivelse", "description", "snippet", "serp", "søkeord", "keyword"])
  );
  const seoStructurePending = seoPending.filter((s) =>
    matchAny(s, ["struktur", "overskrift", "heading", "h1", "h2", "h3", "h4", "outline"])
  );
  const seoInternalLinkPending = seoPending.filter((s) =>
    matchAny(s, ["intern", "lenke", "lenker", "link", "internal"])
  );
  const seoFaqPending = seoPending.filter((s) =>
    matchAny(s, ["faq", "spørsmål", "schema", "structured", "rich", "snippet"])
  );

  const croCtaPending = croPending.filter((s) =>
    matchAny(s, ["cta", "knapp", "kontakt", "demo", "quote", "start", "registrering", "bestill", "sign", "call-to-action"])
  );
  const croTrustFrictionPending = croPending.filter((s) =>
    matchAny(s, ["tillit", "trust", "friksjon", "barriere", "risiko", "garanti", "sikker", "bevis", "proof", "social", "anmeld"])
  );
  const croClarityCopyPending = croPending.filter((s) =>
    matchAny(s, ["klarhet", "copy", "tekst", "tone", "språk", "friksjon", "konverter", "tighten", "kort", "stram"])
  );

  return (
    <section
      className="lp-glass-surface space-y-3 rounded-card border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-4 py-3 text-sm"
      aria-label="AI-assistent"
    >
      <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">AI-assistent</h2>
      <p className="text-xs text-[rgb(var(--lp-muted))]">
        Én analyse, én liste med anbefalinger. Bruk eller avvis her; lagre siden for å beholde endringer.
      </p>
      {contextLabel ? (
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Fokus nå:{" "}
          <span className="inline-block max-w-[260px] truncate align-middle text-[rgb(var(--lp-text))]">
            {contextLabel}
          </span>
        </p>
      ) : null}

      {/* Overview */}
      <div className="space-y-2">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Oversikt</h3>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))]">
                Score:{" "}
                {typeof aiContentScore === "number" ? <strong>{aiContentScore}</strong> : <strong>—</strong>}
                /100
              </span>
              <span className="inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))]">
                SEO{" "}
                {typeof seoScore === "number" ? <strong>{seoScore}</strong> : <strong>—</strong>}
                /100
              </span>
              <span className="inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))]">
                CRO{" "}
                {typeof croScore === "number" ? <strong>{croScore}</strong> : <strong>—</strong>}
                /100
              </span>

              <span className="inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-muted))]">
                {statusLabel}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-white/60 px-3 py-2">
                <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">Health</p>
                <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
                  Content API:{" "}
                  {contentHealthStatus === "available"
                    ? "tilgjengelig"
                    : contentHealthStatus === "unavailable"
                      ? "utilgjengelig"
                      : contentHealthStatus === "checking"
                        ? "sjekker…"
                        : "idle"}
                </p>
                <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
                  Media API:{" "}
                  {mediaHealthStatus === "available"
                    ? "tilgjengelig"
                    : mediaHealthStatus === "unavailable"
                      ? "utilgjengelig"
                      : mediaHealthStatus === "checking"
                        ? "sjekker…"
                        : "idle"}
                </p>
                <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
                  AI:{" "}
                  {aiCapabilityStatus === "available"
                    ? "tilgjengelig"
                    : aiCapabilityStatus === "unavailable"
                      ? "utilgjengelig"
                      : "laster…"}
                </p>
              </div>

              <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-white/60 px-3 py-2">
                <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">Sist analysert</p>
                {lastAnalyzedSummary ? (
                  <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
                    Kort: {lastAnalyzedSummary}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">Kjør analyse for å få en kort oppsummering.</p>
                )}
                <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
                  Først å se:{" "}
                  {attentionItem
                    ? `${attentionItem.source === "seo" ? "SEO" : "CRO"} – ${attentionItem.label}`
                    : "Kjør sideanalyse for å få anbefalinger."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Anbefalinger</h3>
          {pending.length === 0 ? (
            <p className="text-xs text-[rgb(var(--lp-muted))]" aria-live="polite">
              Ingen ventende anbefalinger akkurat nå. Kjør sideanalyse for SEO- og CRO-forslag.
            </p>
          ) : (
            <>
              {pending.length > topPending.length ? (
                <p className="mb-2 text-xs text-[rgb(var(--lp-muted))]">Viser topp {topPending.length} av {pending.length}.</p>
              ) : null}
              <ul className="space-y-2" aria-label="Anbefalinger">
                {topPending.map((s) => {
                  const severity = s.rationale && s.before ? "Høy" : s.rationale ? "Middels" : "Lav";
                  const severityClasses =
                    severity === "Høy"
                      ? "border-rose-200 bg-rose-50 text-rose-800"
                      : severity === "Middels"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-slate-200 bg-slate-50 text-slate-700";

                  return (
                    <li
                      key={`${s.source}-${s.id}`}
                      className="rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-[rgb(var(--lp-text))]">{s.label}</span>
                            <span className="rounded border border-[rgb(var(--lp-border))] px-1.5 py-0.5 text-[10px] uppercase text-[rgb(var(--lp-muted))]">
                              {s.source === "seo" ? "SEO" : "CRO"}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${severityClasses}`}>
                              {severity}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                            <span className="text-[rgb(var(--lp-text))]">Hvorfor det betyr noe: </span>
                            {s.rationale ?? "Dette påvirker klarhet, relevans eller konvertering."}
                          </p>

                          {s.before != null && s.before !== "" ? (
                            <p className="mt-0.5 text-xs">
                              <span className="text-[rgb(var(--lp-muted))]">Nå: </span>
                              <span className="text-[rgb(var(--lp-text))]">{s.before}</span>
                            </p>
                          ) : null}

                          <p className="mt-0.5 text-xs">
                            <span className="text-[rgb(var(--lp-muted))]">Neste: </span>
                            <span className="text-[rgb(var(--lp-text))]">{s.suggested}</span>
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                              onClick={() => onApply(s.id, s.source)}
                              aria-label={`Bruk: ${s.label}`}
                            >
                              Bruk
                            </button>
                            <button
                              type="button"
                              className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                              onClick={() => onDismiss(s.id, s.source)}
                              aria-label={`Avvis: ${s.label}`}
                            >
                              Avvis
                            </button>
                          </div>

                          <p className="text-[10px] text-[rgb(var(--lp-muted))]">
                            Neste handling: <span className="text-[rgb(var(--lp-text))]">Bruk</span> for å oppdatere siden.
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Improve Content (actions) */}
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
            Forbedre innhold
          </h3>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
                disabled={disabled || runAnalysisBusy}
                onClick={onRunAnalysis}
                aria-label="Kjør sideanalyse"
              >
                {runAnalysisBusy ? (
                  <>
                    <Icon name="loading" size="sm" className="animate-spin" aria-hidden />
                    Kjører…
                  </>
                ) : (
                  "Kjør sideanalyse"
                )}
              </button>
              <p className="text-xs text-[rgb(var(--lp-muted))]" aria-live="polite">
                Kjør analyse for å få konkrete innholds-/konverteringsforslag. Neste: velg Bruk på relevante anbefalinger.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-white/60 px-3 py-2">
                <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">Forbedre intro</p>
                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                  Få en tydelig åpning som setter riktig forventning. Neste: se relevante SEO/CRO anbefalinger under “Anbefalinger” og velg Bruk.
                </p>
              </div>

              <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-white/60 px-3 py-2">
                <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">Forbedre headline</p>
                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                  Gjør overskriften mer presis og mer klikkbar. Neste: bruk konkrete forslag (Bruk) når de vises som anbefalinger.
                </p>
              </div>

              <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-white/60 px-3 py-2">
                <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">Forbedre CTA</p>
                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                  Styrk budskapet og handlingen i CTA. Neste: velg Bruk på relevante CRO-forslag i “Anbefalinger”.
                </p>
              </div>

              <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-white/60 px-3 py-2">
                <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">Tighten copy</p>
                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                  Fjern friksjon og gjør teksten mer konverteringsvennlig. Neste: velg Bruk på forslag som passer.
                </p>
              </div>

              <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-white/60 px-3 py-2 sm:col-span-2">
                <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">Mer konverteringsorientert</p>
                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                  Samle SEO + CRO innsikt i et mer målrettet innholdsløp. Neste: kjør analyse og bruk toppforslag.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SEO / CRO suggestions */}
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">SEO / CRO</h3>
          {pending.length === 0 ? (
            <p className="text-xs text-[rgb(var(--lp-muted))]" aria-live="polite">
              Ingen ventende forslag å kategorisere.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-[rgb(var(--lp-border))] bg-white/60 p-3">
                <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">SEO: title, struktur og intern lenking</p>

                <div>
                  <p className="text-xs font-medium text-[rgb(var(--lp-text))]">Tittel og metabeskrivelse</p>
                  {seoTitleMetaPending.length === 0 ? (
                    <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Ingen forslag i denne kategorien.</p>
                  ) : (
                    <ul className="mt-2 space-y-1" aria-label="SEO tittel/metabeskrivelse">
                      {seoTitleMetaPending.slice(0, 3).map((s) => (
                        <li key={s.id} className="rounded border border-[rgb(var(--lp-border))] bg-white/60 px-2 py-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-[rgb(var(--lp-text))]">{s.label}</span>
                              {s.rationale ? (
                                <p className="mt-0.5 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]">{s.rationale}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onApply(s.id, s.source)}
                                aria-label={`Bruk: ${s.label}`}
                              >
                                Bruk
                              </button>
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onDismiss(s.id, s.source)}
                                aria-label={`Avvis: ${s.label}`}
                              >
                                Avvis
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-[rgb(var(--lp-text))]">Struktur og headings</p>
                  {seoStructurePending.length === 0 ? (
                    <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Ingen forslag i denne kategorien.</p>
                  ) : (
                    <ul className="mt-2 space-y-1" aria-label="SEO struktur/headings">
                      {seoStructurePending.slice(0, 3).map((s) => (
                        <li key={s.id} className="rounded border border-[rgb(var(--lp-border))] bg-white/60 px-2 py-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-[rgb(var(--lp-text))]">{s.label}</span>
                              {s.rationale ? (
                                <p className="mt-0.5 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]">{s.rationale}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onApply(s.id, s.source)}
                                aria-label={`Bruk: ${s.label}`}
                              >
                                Bruk
                              </button>
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onDismiss(s.id, s.source)}
                                aria-label={`Avvis: ${s.label}`}
                              >
                                Avvis
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-[rgb(var(--lp-text))]">Interne lenker</p>
                  {seoInternalLinkPending.length === 0 ? (
                    <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Ingen forslag i denne kategorien.</p>
                  ) : (
                    <ul className="mt-2 space-y-1" aria-label="SEO interne lenker">
                      {seoInternalLinkPending.slice(0, 3).map((s) => (
                        <li key={s.id} className="rounded border border-[rgb(var(--lp-border))] bg-white/60 px-2 py-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-[rgb(var(--lp-text))]">{s.label}</span>
                              {s.rationale ? (
                                <p className="mt-0.5 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]">{s.rationale}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onApply(s.id, s.source)}
                                aria-label={`Bruk: ${s.label}`}
                              >
                                Bruk
                              </button>
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onDismiss(s.id, s.source)}
                                aria-label={`Avvis: ${s.label}`}
                              >
                                Avvis
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-[rgb(var(--lp-text))]">FAQ / rich results</p>
                  {seoFaqPending.length === 0 ? (
                    <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Ingen forslag i denne kategorien.</p>
                  ) : (
                    <ul className="mt-2 space-y-1" aria-label="SEO FAQ/rich results">
                      {seoFaqPending.slice(0, 3).map((s) => (
                        <li key={s.id} className="rounded border border-[rgb(var(--lp-border))] bg-white/60 px-2 py-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-[rgb(var(--lp-text))]">{s.label}</span>
                              {s.rationale ? (
                                <p className="mt-0.5 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]">{s.rationale}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onApply(s.id, s.source)}
                                aria-label={`Bruk: ${s.label}`}
                              >
                                Bruk
                              </button>
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onDismiss(s.id, s.source)}
                                aria-label={`Avvis: ${s.label}`}
                              >
                                Avvis
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[rgb(var(--lp-border))] bg-white/60 p-3">
                <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">CRO: CTA, tillit og tydelighet</p>

                <div>
                  <p className="text-xs font-medium text-[rgb(var(--lp-text))]">CTA og konvertering</p>
                  {croCtaPending.length === 0 ? (
                    <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Ingen forslag i denne kategorien.</p>
                  ) : (
                    <ul className="mt-2 space-y-1" aria-label="CRO CTA/konvertering">
                      {croCtaPending.slice(0, 3).map((s) => (
                        <li key={s.id} className="rounded border border-[rgb(var(--lp-border))] bg-white/60 px-2 py-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-[rgb(var(--lp-text))]">{s.label}</span>
                              {s.rationale ? (
                                <p className="mt-0.5 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]">{s.rationale}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onApply(s.id, s.source)}
                                aria-label={`Bruk: ${s.label}`}
                              >
                                Bruk
                              </button>
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onDismiss(s.id, s.source)}
                                aria-label={`Avvis: ${s.label}`}
                              >
                                Avvis
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-[rgb(var(--lp-text))]">Tillit og friksjon</p>
                  {croTrustFrictionPending.length === 0 ? (
                    <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Ingen forslag i denne kategorien.</p>
                  ) : (
                    <ul className="mt-2 space-y-1" aria-label="CRO tillit/friksjon">
                      {croTrustFrictionPending.slice(0, 3).map((s) => (
                        <li key={s.id} className="rounded border border-[rgb(var(--lp-border))] bg-white/60 px-2 py-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-[rgb(var(--lp-text))]">{s.label}</span>
                              {s.rationale ? (
                                <p className="mt-0.5 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]">{s.rationale}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onApply(s.id, s.source)}
                                aria-label={`Bruk: ${s.label}`}
                              >
                                Bruk
                              </button>
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onDismiss(s.id, s.source)}
                                aria-label={`Avvis: ${s.label}`}
                              >
                                Avvis
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-[rgb(var(--lp-text))]">Klarhet og copy</p>
                  {croClarityCopyPending.length === 0 ? (
                    <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Ingen forslag i denne kategorien.</p>
                  ) : (
                    <ul className="mt-2 space-y-1" aria-label="CRO klarhet/copy">
                      {croClarityCopyPending.slice(0, 3).map((s) => (
                        <li key={s.id} className="rounded border border-[rgb(var(--lp-border))] bg-white/60 px-2 py-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-[rgb(var(--lp-text))]">{s.label}</span>
                              {s.rationale ? (
                                <p className="mt-0.5 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]">{s.rationale}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onApply(s.id, s.source)}
                                aria-label={`Bruk: ${s.label}`}
                              >
                                Bruk
                              </button>
                              <button
                                type="button"
                                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                onClick={() => onDismiss(s.id, s.source)}
                                aria-label={`Avvis: ${s.label}`}
                              >
                                Avvis
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Actions (run tools) */}
        {aiActions ? (
          <div className="pt-1">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              AI-handlinger
            </h3>
            {/*
              Rendered in-place to keep existing editor AI tools behavior.
              No extra state is introduced here; only UI composition.
            */}
            <div>{aiActions}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
