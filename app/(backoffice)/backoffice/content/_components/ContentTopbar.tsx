"use client";

import { BackofficeOverflowActionBar } from "@/components/backoffice/BackofficeOverflowActionBar";
import type { StatusLineState, SupportSnapshot } from "./types";
import type { PageStatus } from "./contentTypes";

type Props = {
  title: string;
  slug: string;
  statusLabel: PageStatus;
  statusBadgeClass: string;
  statusLine: StatusLineState;
  supportSnapshot?: SupportSnapshot | null;
  supportCopyFeedback?: "ok" | "fail" | null;
  canPublish: boolean;
  canUnpublish: boolean;
  selectedId?: string | null;
  pageExists: boolean;
  isOffline: boolean;
  publishDisabledTitle?: string;
  unpublishDisabledTitle?: string;
  /** Brief feedback after publish/unpublish (e.g. "Publisert" or "Satt til kladd"). Shown next to status. */
  statusFeedback?: string | null;
  /** When page is published, when it was last published (for "Sist publisert" and live clarity). */
  publishedAt?: string | null;
  /** Format date for display. */
  formatDate?: (value: string | null | undefined) => string;
  /** When true, variant is part of a scheduled release (enterprise visibility). */
  inScheduledRelease?: boolean;
  onCopySupportSnapshot: () => void;
  onRetrySave: () => void;
  onReload: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
};

export function ContentTopbar({
  title,
  slug,
  statusLabel,
  statusBadgeClass,
  statusLine,
  supportSnapshot,
  supportCopyFeedback,
  selectedId,
  pageExists,
  isOffline,
  statusFeedback,
  publishedAt,
  formatDate,
  inScheduledRelease,
  onCopySupportSnapshot,
  onRetrySave,
  onReload,
  onPublish: _onPublish,
  onUnpublish: _onUnpublish,
}: Props) {
  const canRetry = statusLine.actions.retry && !isOffline;
  const canReload = statusLine.actions.reload && !isOffline;
  const disableRetry = !selectedId || !pageExists || isOffline;
  const formattedPublished = publishedAt != null && formatDate ? formatDate(publishedAt) : null;

  return (
    <div
      role="status"
      className="font-ui sticky top-0 z-20 flex flex-col gap-3 border-b border-[rgb(var(--lp-border))] bg-white px-3 py-3 text-sm text-[rgb(var(--lp-text))] shadow-sm sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[min(100%,42rem)]">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass}`}
            data-lp-publish-state={statusLabel}
          >
            {statusLabel === "published" ? "Publisert" : "Kladd"}
          </span>
          {inScheduledRelease ? (
            <span
              className="shrink-0 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              title="Denne varianten er med i en planlagt release"
            >
              Planlagt release
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-[rgb(var(--lp-text))]">{title || "Untitled"}</div>
          <div className="truncate text-sm text-[rgb(var(--lp-muted))]">{slug || "—"}</div>
          {statusLabel === "published" && formattedPublished ? (
            <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">Sist publisert {formattedPublished}</div>
          ) : statusLabel === "draft" ? (
            <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">Ikke synlig på nettsiden før publisering</div>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:items-end" aria-live="polite" aria-atomic="true">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-medium ${statusLine.tone}`} key={statusLine.key}>
            {statusLine.label}
            {statusLine.detail ? (
              <span
                className={`ml-1.5 font-normal ${statusLine.key === "saved" ? "text-[rgb(var(--lp-muted))]" : "text-amber-800"}`}
              >
                {statusLine.detail}
              </span>
            ) : null}
          </span>
          {statusFeedback ? (
            <span className="text-xs font-medium text-green-700" role="status">
              {statusFeedback}
            </span>
          ) : null}
        </div>
        <BackofficeOverflowActionBar
          summaryLabel="Support og diagnose"
          hasSecondary={Boolean(supportSnapshot || canRetry || canReload)}
          primary={null}
          secondary={
            <>
              {supportSnapshot ? (
                <>
                  <button
                    type="button"
                    onClick={onCopySupportSnapshot}
                    className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Kopier support
                  </button>
                  {supportCopyFeedback === "ok" ? <span className="text-xs text-green-700">Kopiert</span> : null}
                  {supportCopyFeedback === "fail" ? <span className="text-xs text-slate-500">Kunne ikke kopiere</span> : null}
                </>
              ) : null}
              {canRetry ? (
                <button
                  type="button"
                  onClick={onRetrySave}
                  disabled={disableRetry}
                  title={!selectedId || !pageExists ? "Mangler side" : isOffline ? "Du er offline" : "Lagre på nytt"}
                  aria-label="Lagre på nytt"
                  className="min-h-10 w-full rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-left text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Lagre på nytt
                </button>
              ) : null}
              {canReload ? (
                <button
                  type="button"
                  onClick={onReload}
                  disabled={isOffline}
                  title={isOffline ? "Du er offline" : "Last siden på nytt for å løse konflikt"}
                  aria-label="Last siden på nytt"
                  className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Last på nytt
                </button>
              ) : null}
            </>
          }
        />
      </div>
    </div>
  );
}

