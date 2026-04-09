"use client";

export type DesignIssueRow = {
  id: string;
  severity: "info" | "warn" | "fail";
  message: string;
};

export type EditorDesignAiPanelProps = {
  enabled: boolean;
  designScore: number | null;
  designIssues: DesignIssueRow[];
  designSuggestions: string[];
  previewSuggestionLines: string[];
  busy: boolean;
  error: string | null;
  hasPreview: boolean;
  onAnalyze: () => void;
  onImprove: () => void;
  onApplyPreview: () => void;
  onDiscardPreview: () => void;
};

function severityLabel(s: DesignIssueRow["severity"]): string {
  if (s === "fail") return "Kritisk";
  if (s === "warn") return "Advarsel";
  return "Info";
}

/**
 * On-demand design analysis + preview-only improvements (no auto-apply).
 */
export function EditorDesignAiPanel({
  enabled,
  designScore,
  designIssues,
  designSuggestions,
  previewSuggestionLines,
  busy,
  error,
  hasPreview,
  onAnalyze,
  onImprove,
  onApplyPreview,
  onDiscardPreview,
}: EditorDesignAiPanelProps) {
  if (!enabled) return null;

  return (
    <section
      aria-label="AI design"
      className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Design (AI)</p>
        <span
          className="inline-flex shrink-0 rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/70 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[rgb(var(--lp-text))]"
          title="Design score fra strukturanalyse"
        >
          Score: {designScore !== null ? `${designScore}` : "—"}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
        Analyse og forbedringsforslag er forhåndsvisning. Ingen auto-lagring eller publisering.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAnalyze}
          className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Kjører…" : "Analyser design"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onImprove}
          className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50"
        >
          Forbedre design
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-700" aria-live="polite">
          {error}
        </p>
      ) : null}

      {designIssues.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Funn</p>
          <ul className="mt-1 space-y-1.5 text-xs text-[rgb(var(--lp-text))]">
            {designIssues.map((issue) => (
              <li key={issue.id} className="leading-snug">
                <span className="mr-1 text-[10px] font-medium text-[rgb(var(--lp-muted))]">
                  [{severityLabel(issue.severity)}]
                </span>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {designSuggestions.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Forslag</p>
          <ul className="mt-1 space-y-1.5 text-xs text-[rgb(var(--lp-text))]">
            {designSuggestions.map((s, i) => (
              <li key={`${i}-${s.slice(0, 24)}`} className="leading-snug">
                <span className="mr-1 opacity-60" aria-hidden>
                  →
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasPreview ? (
        <div
          className="mt-3 rounded-lg border border-pink-500/40 bg-pink-50/50 px-2.5 py-2"
          role="region"
          aria-label="Forhåndsvisning klar"
        >
          <p className="text-xs font-medium text-[rgb(var(--lp-text))]">Forhåndsvisning klar</p>
          {previewSuggestionLines.length > 0 ? (
            <ul className="mt-1 space-y-1 text-[11px] text-[rgb(var(--lp-muted))]">
              {previewSuggestionLines.map((s, i) => (
                <li key={`p-${i}-${s.slice(0, 20)}`}>{s}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApplyPreview}
              className="min-h-[40px] rounded-lg px-3 text-xs font-semibold text-pink-600 underline decoration-pink-500/60 underline-offset-4 hover:underline"
            >
              Godkjenn og bruk i redigereren
            </button>
            <button
              type="button"
              onClick={onDiscardPreview}
              className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
            >
              Forkast forhåndsvisning
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
