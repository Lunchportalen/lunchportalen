"use client";

/**
 * AI quick-fix suggestions: Add intro, Add CTA, Add FAQ.
 * Each suggestion has a "Legg til" button that triggers the parent-provided handler.
 */

import type { QuickFixSuggestion } from "./quickFixSuggestions";

export type AiQuickFixSuggestionsProps = {
  suggestions: QuickFixSuggestion[];
  onApply: (kind: string) => void;
  disabled?: boolean;
  /** Optional: which kind is currently being applied (show loading). */
  applyingKind?: string | null;
};

export function AiQuickFixSuggestions({
  suggestions,
  onApply,
  disabled = false,
  applyingKind = null,
}: AiQuickFixSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <section
      className="lp-glass-surface space-y-3 rounded-card px-4 py-3 text-sm"
      aria-label="AI hurtigfikser"
    >
      <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Hurtigfikser</h2>
      <p className="text-xs text-[rgb(var(--lp-muted))]">
        Forslag basert på innholdet. Klikk for å legge til blokk(er).
      </p>
      <ul className="space-y-2" aria-label="Hurtigfiksforslag">
        {suggestions.map((s) => {
          const isApplying = applyingKind === s.kind;
          return (
            <li
              key={s.id}
              className="flex flex-col gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">{s.label}</p>
                {s.description ? (
                  <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">{s.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onApply(s.kind)}
                disabled={disabled || isApplying}
                className="self-start rounded border border-[rgb(var(--lp-border))] bg-white px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                aria-label={`${s.label}: Legg til`}
              >
                {isApplying ? "Legger til…" : "Legg til"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
