"use client";

type ContentTopStatusPanelProps = {
  title: string;
  setTitle: (value: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  statusToneClass: string;
  statusLabel: string;
  page: { id: string; updated_at: string | null };
  formatDate: (value: string | null | undefined) => string;
  canOpenPublic: boolean;
  onOpenPublicPage: () => void;
  /** AI content quality score 0–100 (from SEO + CRO). */
  aiContentScore?: number;
  /** True when score is based on both SEO and CRO analyses. */
  aiContentScoreHasBoth?: boolean;
  /** Top attention point based on pending AI recommendations (UI only). */
  attentionLabel?: string | null;
  attentionSource?: "seo" | "cro" | null;
  /** Single next action for the editor workflow (UI only). */
  nextActionLabel?: string | null;
  onNextAction?: (() => void) | null;
  nextActionDisabled?: boolean;
  nextActionBusy?: boolean;
};

export function ContentTopStatusPanel({
  title,
  setTitle,
  activeTab,
  setActiveTab,
  statusToneClass,
  statusLabel,
  page,
  formatDate,
  canOpenPublic,
  onOpenPublicPage,
  aiContentScore,
  aiContentScoreHasBoth = false,
  attentionLabel = null,
  attentionSource = null,
  nextActionLabel = null,
  onNextAction = null,
  nextActionDisabled = false,
  nextActionBusy = false,
}: ContentTopStatusPanelProps) {
  const score =
    typeof aiContentScore === "number" && !Number.isNaN(aiContentScore)
      ? Math.max(0, Math.min(100, Math.round(aiContentScore)))
      : null;
  return (
    <>
      {/* U1 – typography/spacing tightening */}
      <label className="block">
        <span className="sr-only">Sidetittel</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sidetittel (f.eks. Hjem)"
          className="mt-1.5 w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2.5 text-base font-medium text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
        />
      </label>

      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[rgb(var(--lp-border))] bg-white px-1 pt-1.5 pb-1">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["innhold", "Innhold"],
              ["ekstra", "Ekstra innhold"],
              ["oppsummering", "Oppsummering"],
              ["navigasjon", "Navigasjon"],
              ["seo", "SEO & deling"],
              ["cro", "CRO"],
              ["aimaal", "AI & mål"],
              ["scripts", "Scripts"],
              ["avansert", "Avansert"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`min-h-[40px] rounded-t-lg border border-b-0 px-4 text-sm font-medium ${
                activeTab === tab
                  ? "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-text))]"
                  : "border-transparent bg-transparent text-[rgb(var(--lp-muted))] hover:bg-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pb-1 pr-1 text-xs text-[rgb(var(--lp-muted))]">
          {score !== null ? (
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${
                score >= 70
                  ? "border-green-200 bg-green-50 text-green-800"
                  : score >= 40
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
              title={aiContentScoreHasBoth ? "Basert på SEO- og CRO-analyse" : "Kjør SEO- og CRO-analyse for full score"}
            >
              AIContentScore: {score}/100
            </span>
          ) : null}
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-medium ${statusToneClass}`}
          >
            {statusLabel}
          </span>
          <span>Oppdatert {formatDate(page.updated_at)}</span>
          <span className="ml-2 hidden md:inline">ID: {page.id}</span>
          {canOpenPublic && (
            <button
              type="button"
              onClick={onOpenPublicPage}
              className="ml-2 inline-flex items-center gap-1 rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1 text-[11px] font-medium text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))]/60 hover:text-[rgb(var(--lp-text))]"
            >
              <span aria-hidden>↗</span>
              <span>Åpne offentlig side</span>
            </button>
          )}

          {attentionLabel ? (
            <span
              className="ml-2 inline-flex max-w-[260px] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700"
              title={attentionLabel}
            >
              <span className="shrink-0">
                Neste:
                {attentionSource ? ` ${attentionSource.toUpperCase()}` : ""}
              </span>
              <span className="truncate">{attentionLabel}</span>
            </span>
          ) : null}

          {nextActionLabel && onNextAction ? (
            <button
              type="button"
              onClick={onNextAction}
              disabled={nextActionDisabled || nextActionBusy}
              className="ml-2 inline-flex min-h-[28px] items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1 text-[11px] font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {nextActionBusy ? "Kjører…" : nextActionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

