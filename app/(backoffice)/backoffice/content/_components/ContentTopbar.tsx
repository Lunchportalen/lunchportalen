"use client";

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
  canPublish,
  canUnpublish,
  selectedId,
  pageExists,
  isOffline,
  publishDisabledTitle,
  unpublishDisabledTitle,
  statusFeedback,
  publishedAt,
  formatDate,
  inScheduledRelease,
  onCopySupportSnapshot,
  onRetrySave,
  onReload,
  onPublish,
  onUnpublish,
}: Props) {
  const canRetry = statusLine.actions.retry && !isOffline;
  const canReload = statusLine.actions.reload && !isOffline;
  const disableRetry = !selectedId || !pageExists || isOffline;
  const formattedPublished = publishedAt != null && formatDate ? formatDate(publishedAt) : null;

  return (
    <div
      role="status"
      className="font-ui sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))] shadow-sm"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
          {statusLabel === "published" ? "Publisert" : "Kladd"}
        </span>
        {inScheduledRelease && (
          <span
            className="shrink-0 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
            title="Denne varianten er med i en planlagt release"
          >
            I planlagt release
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-base font-medium text-[rgb(var(--lp-text))]">{title || "Untitled"}</div>
          <div className="truncate text-xs text-[rgb(var(--lp-muted))]">{slug || "—"}</div>
          {statusLabel === "published" && formattedPublished ? (
            <div className="text-xs text-[rgb(var(--lp-muted))]">
              Live = sist publisert {formattedPublished}
            </div>
          ) : statusLabel === "draft" ? (
            <div className="text-xs text-[rgb(var(--lp-muted))]">
              Kladd = ikke synlig på nettsiden
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="flex flex-wrap items-center gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusLine.tone}`} key={statusLine.key}>
          {statusLine.label}
        </span>
        {statusLine.detail ? (
          <span
            className={`text-xs ${statusLine.key === "saved" ? "text-[rgb(var(--lp-muted))]" : "text-amber-800"}`}
          >
            {statusLine.detail}
          </span>
        ) : null}
        {statusFeedback ? (
          <span className="text-xs font-medium text-green-700" role="status">
            {statusFeedback}
          </span>
        ) : null}
        {supportSnapshot && (
          <>
            <button
              type="button"
              onClick={onCopySupportSnapshot}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              Kopier
            </button>
            {supportCopyFeedback === "ok" && <span className="text-xs text-green-700">Kopiert</span>}
            {supportCopyFeedback === "fail" && <span className="text-xs text-slate-500">Kunne ikke kopiere</span>}
          </>
        )}
        {canRetry && (
          <button
            type="button"
            onClick={onRetrySave}
            disabled={disableRetry}
            title={!selectedId || !pageExists ? "Mangler side" : isOffline ? "Du er offline" : "Lagre på nytt"}
            aria-label="Lagre på nytt"
            className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Lagre på nytt
          </button>
        )}
        {canReload && (
          <button
            type="button"
            onClick={onReload}
            disabled={isOffline}
            title={isOffline ? "Du er offline" : "Last siden på nytt for å løse konflikt"}
            aria-label="Last siden på nytt"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Last på nytt
          </button>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onPublish()}
          disabled={!canPublish}
          title={publishDisabledTitle ?? undefined}
          aria-label="Publiser siden"
          className="min-h-8 rounded-md border border-green-600 bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Publiser
        </button>
        {statusLabel === "published" ? (
          <button
            type="button"
            onClick={() => void onUnpublish()}
            disabled={!canUnpublish}
            title={unpublishDisabledTitle ?? undefined}
            aria-label="Sett tilbake til kladd (ta siden ut av publisering)"
            className="min-h-8 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sett til kladd
          </button>
        ) : null}
      </div>
    </div>
  );
}

