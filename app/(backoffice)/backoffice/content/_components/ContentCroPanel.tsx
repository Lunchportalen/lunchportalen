"use client";

// STATUS: KEEP

import type { CroRecommendationsState } from "@/lib/cro/editorState";
import { isCroSuggestionApplicable } from "@/lib/cro/apply";
import type { CroSuggestionType } from "@/lib/cro/suggestions";

const CATEGORY_LABELS: Record<string, string> = {
  cta: "CTA",
  messaging: "Melding",
  structure: "Struktur",
  trust: "Tillit",
  friction: "Friksjon",
  offer: "Tilbud",
};

type ContentCroPanelProps = {
  croRecommendationsState: CroRecommendationsState | null;
  onRunCroAnalysis: () => void;
  onDismissCroSuggestion: (rec: { id: string }) => void;
  onApplyCroSuggestion?: (rec: import("@/lib/cro/editorState").CroRecommendation) => void;
  onFocusBlockId?: (blockId: string) => void;
  croAnalysisBusy?: boolean;
  isOffline?: boolean;
  effectiveId?: string | null;
};

export function ContentCroPanel({
  croRecommendationsState,
  onRunCroAnalysis,
  onDismissCroSuggestion,
  onApplyCroSuggestion,
  onFocusBlockId,
  croAnalysisBusy = false,
  isOffline = false,
  effectiveId = null,
}: ContentCroPanelProps) {
  const pendingSuggestions = croRecommendationsState?.suggestions?.filter((s) => s.status === "pending") ?? [];
  const dismissedSuggestions = croRecommendationsState?.suggestions?.filter((s) => s.status === "dismissed") ?? [];
  const appliedSuggestions = croRecommendationsState?.suggestions?.filter((s) => s.status === "applied") ?? [];

  return (
    <div className="lp-glass-panel space-y-4 rounded-b-2xl rounded-t-lg border-t-0 p-4">
      <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">CRO – konverteringsoptimalisering</h3>

      <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 p-4">
        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">CRO-analyse</p>
        <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
          Score og forslag basert på CTA, overskrift, verdiargumenter, tillit og friksjon. Forslag er kun anbefalinger; du redigerer innholdet manuelt eller avviser. Kjør på nytt etter endringer for oppdatert score.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {croRecommendationsState != null ? (
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${
                croRecommendationsState.score >= 70
                  ? "border-green-200 bg-green-50 text-green-800"
                  : croRecommendationsState.score >= 40
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              Score: {croRecommendationsState.score}/100
            </span>
          ) : null}
          {croRecommendationsState?.lastRunAt ? (
            <span className="text-xs text-[rgb(var(--lp-muted))]">
              Sist kjørt: {new Date(croRecommendationsState.lastRunAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}
            </span>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            disabled={isOffline || !effectiveId || croAnalysisBusy}
            onClick={() => onRunCroAnalysis()}
          >
            {croAnalysisBusy ? "Kjører analyse…" : "Kjør CRO-analyse"}
          </button>
        </div>

        {pendingSuggestions.length > 0 ? (
          <ul className="mt-4 space-y-3 border-t border-[rgb(var(--lp-border))] pt-4">
            {pendingSuggestions.map((rec) => (
              <li key={rec.id} className="rounded-lg border border-[rgb(var(--lp-border))] bg-white p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-[rgb(var(--lp-text))]">{rec.label}</span>
                    <span className="ml-2 text-[10px] uppercase text-[rgb(var(--lp-muted))]">
                      {CATEGORY_LABELS[rec.category] ?? rec.category}
                    </span>
                    {rec.priority ? (
                      <span className="ml-2 text-[10px] text-[rgb(var(--lp-muted))]">{rec.priority}</span>
                    ) : null}
                    <dl className="mt-1.5 grid gap-1 text-xs">
                      {rec.before ? (
                        <div>
                          <dt className="text-[rgb(var(--lp-muted))]">Nå</dt>
                          <dd className="text-[rgb(var(--lp-text))]">{rec.before}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-[rgb(var(--lp-muted))]">Anbefaling</dt>
                        <dd className="text-[rgb(var(--lp-text))]">{rec.recommendedChange || "—"}</dd>
                      </div>
                      {rec.rationale ? (
                        <div>
                          <dt className="text-[rgb(var(--lp-muted))]">Hvorfor</dt>
                          <dd className="text-[rgb(var(--lp-muted))]">{rec.rationale}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    {onApplyCroSuggestion && isCroSuggestionApplicable(rec.type as CroSuggestionType) ? (
                      <button
                        type="button"
                        className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-[10px] font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                        onClick={() => onApplyCroSuggestion(rec)}
                        aria-label={`Bruk forslag: ${rec.label}`}
                      >
                        Bruk
                      </button>
                    ) : null}
                    {rec.target === "block" && rec.targetBlockId && onFocusBlockId ? (
                      <button
                        type="button"
                        className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-[10px] font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                        onClick={() => onFocusBlockId(rec.targetBlockId)}
                        aria-label={`Gå til blokk: ${rec.label}`}
                      >
                        Gå til blokk
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-[10px] font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                      onClick={() => onDismissCroSuggestion(rec)}
                      aria-label={`Avvis forslag: ${rec.label}`}
                    >
                      Avvis
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {(dismissedSuggestions.length > 0 || appliedSuggestions.length > 0) ? (
          <details className="mt-3 border-t border-[rgb(var(--lp-border))] pt-3">
            <summary className="cursor-pointer text-xs font-medium text-[rgb(var(--lp-muted))]">
              Avviste / brukte forslag ({dismissedSuggestions.length + appliedSuggestions.length})
            </summary>
            <ul className="mt-2 space-y-1.5 text-xs">
              {dismissedSuggestions.map((rec) => (
                <li key={rec.id} className="flex items-center gap-2 text-[rgb(var(--lp-muted))]">
                  <span className="font-medium text-[rgb(var(--lp-text))]">{rec.label}</span>
                  <span className="rounded border border-[rgb(var(--lp-border))] px-1.5 py-0.5 text-[10px]">
                    Avvist
                  </span>
                </li>
              ))}
              {appliedSuggestions.map((rec) => (
                <li key={rec.id} className="flex items-center gap-2 text-[rgb(var(--lp-muted))]">
                  <span className="font-medium text-[rgb(var(--lp-text))]">{rec.label}</span>
                  <span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] text-green-800">
                    Brukt
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
