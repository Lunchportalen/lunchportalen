"use client";

export type CopilotSuggestion = {
  id: string;
  text: string;
  type: "seo" | "cro" | "clarity";
  targetBlockId?: string;
  applyHint?: Record<string, unknown>;
};

const TYPE_LABEL: Record<CopilotSuggestion["type"], string> = {
  seo: "SEO",
  cro: "CRO",
  clarity: "Klarhet",
};

export type EditorCopilotRailProps = {
  suggestions: CopilotSuggestion[];
  busy?: boolean;
  error?: string | null;
  onApply: (s: CopilotSuggestion) => void;
  onDismiss?: (id: string) => void;
};

/**
 * Non-intrusive hints for the left editor rail (no modal / no popover).
 */
export function EditorCopilotRail({ suggestions, busy = false, error = null, onApply, onDismiss }: EditorCopilotRailProps) {
  return (
    <section
      className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 px-3 py-2 text-xs"
      aria-label="AI medforfatter"
    >
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
        Medforfatter
      </h3>
      {busy && suggestions.length === 0 ? (
        <p className="text-[rgb(var(--lp-muted))]">Analyserer …</p>
      ) : null}
      {error ? <p className="text-red-600">{error}</p> : null}
      {!busy && !error && suggestions.length === 0 ? (
        <p className="text-[rgb(var(--lp-muted))]">Velg en tekst-, hero- eller CTA-blokk for forslag mens du skriver.</p>
      ) : null}
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li key={s.id} className="rounded-md border border-black/5 bg-white/60 px-2 py-1.5">
            <p className="text-[rgb(var(--lp-text))] leading-snug">
              <span className="mr-1 opacity-70" aria-hidden>
                💡
              </span>
              {s.text}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-[rgb(var(--lp-muted))]">
                {TYPE_LABEL[s.type]}
              </span>
              <button
                type="button"
                className="text-[10px] font-medium text-pink-600 underline-offset-2 hover:underline"
                onClick={() => onApply(s)}
              >
                Gå til blokk
              </button>
              {onDismiss ? (
                <button
                  type="button"
                  className="text-[10px] text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                  onClick={() => onDismiss(s.id)}
                >
                  Skjul
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
