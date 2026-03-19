"use client";

export type ContentAiContextPanelProps = {
  aiCapability: "loading" | "available" | "unavailable";
  pageId: string | null | undefined;
  pageTitle: string;
  pageSlug: string;
  expandedBlockId: string | null;
  focusedBlockLabel: string | null;
  aiSummary: string | null;
  aiError: string | null;
};

export function ContentAiContextPanel({
  aiCapability,
  pageId,
  pageTitle,
  pageSlug,
  expandedBlockId,
  focusedBlockLabel,
  aiSummary,
  aiError,
}: ContentAiContextPanelProps) {
  const capabilityLabel =
    aiCapability === "available"
      ? "AI: Tilgjengelig"
      : aiCapability === "loading"
        ? "AI: Sjekker…"
        : "AI: Ikke tilgjengelig";

  return (
    <section
      aria-label="AI-kontekst"
      className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            AI-kontekst
          </p>
          <p className="mt-1 truncate text-xs text-slate-600" title={pageTitle || undefined}>
            Side: {pageTitle || "—"}
          </p>
        </div>
        <span
          className="inline-flex shrink-0 rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]"
          title={capabilityLabel}
        >
          {capabilityLabel}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <dl className="grid gap-2">
          <div>
            <dt className="text-[11px] text-[rgb(var(--lp-muted))]">Side-ID</dt>
            <dd className="font-mono text-xs text-[rgb(var(--lp-text))] truncate" title={pageId ?? undefined}>
              {pageId ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[rgb(var(--lp-muted))]">Slug</dt>
            <dd className="text-xs text-[rgb(var(--lp-text))] truncate" title={pageSlug || undefined}>
              {pageSlug || "—"}
            </dd>
          </div>
        </dl>

        <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 px-2.5 py-2">
          <p className="text-[11px] font-medium text-[rgb(var(--lp-muted))]">Fokus</p>
          {focusedBlockLabel ? (
            <p
              className="mt-0.5 truncate text-xs text-[rgb(var(--lp-text))]"
              title={focusedBlockLabel}
            >
              Blokk: {focusedBlockLabel}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
              Blokk: {expandedBlockId ? "Ukjent blokk" : "Ingen blokk valgt"}
            </p>
          )}
        </div>

        {aiError ? (
          <p className="text-xs text-red-700" aria-live="polite">
            AI-feil: {aiError}
          </p>
        ) : aiSummary ? (
          <p className="text-xs text-slate-700" aria-live="polite">
            Sist: <span className="font-medium">{aiSummary}</span>
          </p>
        ) : (
          <p className="text-xs text-[rgb(var(--lp-muted))]" aria-live="polite">
            Ingen nylige AI-resultater.
          </p>
        )}
      </div>
    </section>
  );
}

