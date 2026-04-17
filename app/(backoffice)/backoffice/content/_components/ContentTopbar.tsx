"use client";

import { usePathname } from "next/navigation";
import { BackofficeOverflowActionBar } from "@/components/backoffice/BackofficeOverflowActionBar";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
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
  title: _title,
  slug: _slug,
  statusLabel: _statusLabel,
  statusBadgeClass: _statusBadgeClass,
  statusLine,
  supportSnapshot,
  supportCopyFeedback,
  selectedId,
  pageExists,
  isOffline,
  statusFeedback,
  publishedAt: _publishedAt,
  formatDate: _formatDate,
  inScheduledRelease,
  onCopySupportSnapshot,
  onRetrySave,
  onReload,
  onPublish: _onPublish,
  onUnpublish: _onUnpublish,
}: Props) {
  const pathname = usePathname() ?? "";
  const isContentDetailEditor = resolveBackofficeContentRoute(pathname).kind === "detail";

  const canRetry = statusLine.actions.retry && !isOffline;
  const canReload = statusLine.actions.reload && !isOffline;
  const disableRetry = !selectedId || !pageExists || isOffline;

  const hasDetailOverflowActions = Boolean(supportSnapshot || canRetry || canReload);
  const hasDetailSecondarySignals = Boolean(statusFeedback || inScheduledRelease);

  if (isContentDetailEditor && !hasDetailOverflowActions && !hasDetailSecondarySignals) {
    return null;
  }

  const detailOnlyActions =
    isContentDetailEditor && hasDetailOverflowActions && !hasDetailSecondarySignals;

  return (
    <div
      role="status"
      className={`font-ui sticky top-0 z-20 flex flex-col gap-2 border-b border-[rgb(var(--lp-border))] bg-white text-sm text-[rgb(var(--lp-text))] shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 ${
        isContentDetailEditor ? "px-2 py-1" : "px-3 py-2"
      } ${detailOnlyActions ? "sm:justify-end" : "sm:justify-between"}`}
    >
      {/*
        Tittel, slug og publiseringsstatus vises i BellissimaWorkspaceHeader over.
        Her: lagring/sync-linje, release-hint og sekundær diagnose — uten duplikat av dokumentmetadata.
      */}
      {!isContentDetailEditor ? (
        <div
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 sm:max-w-[min(100%,48rem)]"
          aria-live="polite"
          aria-atomic="true"
        >
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
          {inScheduledRelease ? (
            <span
              className="shrink-0 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
              title="Denne varianten er med i en planlagt release"
            >
              Planlagt release
            </span>
          ) : null}
        </div>
      ) : hasDetailSecondarySignals ? (
        <div
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 sm:max-w-[min(100%,48rem)]"
          aria-live="polite"
          aria-atomic="true"
        >
          {statusFeedback ? (
            <span className="text-xs font-medium text-green-700" role="status">
              {statusFeedback}
            </span>
          ) : null}
          {inScheduledRelease ? (
            <span
              className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
              title="Denne varianten er med i en planlagt release"
            >
              Planlagt release
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-w-0 shrink-0 flex-col gap-2 sm:items-end">
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

