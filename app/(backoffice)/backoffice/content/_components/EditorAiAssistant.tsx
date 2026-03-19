"use client";

/**
 * Editor AI Assistant sidebar.
 * Displays suggestions, warnings, and improvements in three sections.
 * Structural only; parent supplies items. No business logic.
 */

export type EditorAiAssistantItem = {
  id: string;
  title: string;
  description?: string | null;
};

export type EditorAiAssistantProps = {
  /** Suggestions (e.g. SEO, CRO, layout). */
  suggestions?: EditorAiAssistantItem[];
  /** Warnings (e.g. missing alt, weak CTA). */
  warnings?: EditorAiAssistantItem[];
  /** Improvements (e.g. tone, structure). */
  improvements?: EditorAiAssistantItem[];
  /** Optional section title override. */
  title?: string | null;
};

function ItemList({
  items,
  emptyLabel,
  ariaLabel,
}: {
  items: EditorAiAssistantItem[];
  emptyLabel: string;
  ariaLabel: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-[rgb(var(--lp-muted))]" aria-live="polite">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="space-y-2" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-3 py-2">
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">{item.title}</p>
          {item.description ? (
            <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">{item.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function EditorAiAssistant({
  suggestions = [],
  warnings = [],
  improvements = [],
  title = "AI-assistent",
}: EditorAiAssistantProps) {
  const hasAny = suggestions.length > 0 || warnings.length > 0 || improvements.length > 0;

  return (
    <section
      className="lp-glass-surface space-y-4 rounded-card px-4 py-3 text-sm"
      aria-label={title}
    >
      <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">{title}</h2>
      <p className="text-xs text-[rgb(var(--lp-muted))]">
        Forslag, advarsler og forbedringer for denne siden. Oppdateres når du kjører analyse eller AI-verktøy.
      </p>

      {!hasAny ? (
        <p className="text-xs text-[rgb(var(--lp-muted))]" aria-live="polite">
          Ingen forslag, advarsler eller forbedringer akkurat nå. Kjør SEO-, CRO- eller layoutanalyse for å se anbefalinger.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Forslag
            </h3>
            <ItemList
              items={suggestions}
              emptyLabel="Ingen forslag."
              ariaLabel="Forslag"
            />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Advarsler
            </h3>
            <ItemList
              items={warnings}
              emptyLabel="Ingen advarsler."
              ariaLabel="Advarsler"
            />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Forbedringer
            </h3>
            <ItemList
              items={improvements}
              emptyLabel="Ingen forbedringer."
              ariaLabel="Forbedringer"
            />
          </div>
        </div>
      )}
    </section>
  );
}
