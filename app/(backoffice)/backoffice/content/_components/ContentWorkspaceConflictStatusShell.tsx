"use client";

/**
 * Konflikt-tilstand: statuslinje + «last på nytt»-panel (I1/I4 wiring fra workspace).
 */

import type { StatusLineState, SupportSnapshot } from "./types";

export type ContentWorkspaceConflictStatusShellProps = {
  statusLine: StatusLineState;
  supportSnapshot: SupportSnapshot | null | undefined;
  supportCopyFeedback: "ok" | "fail" | null;
  copySupportSnapshot: () => void;
  reloadDetailFromServer: () => void;
  isOffline: boolean;
  guardPush: (href: string) => void;
};

export function ContentWorkspaceConflictStatusShell(props: ContentWorkspaceConflictStatusShellProps) {
  const {
    statusLine,
    supportSnapshot,
    supportCopyFeedback,
    copySupportSnapshot,
    reloadDetailFromServer,
    isOffline,
    guardPush,
  } = props;

  return (
    <>
      <div
        role="status"
        className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm text-[rgb(var(--lp-text))]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusLine.tone}`} key={statusLine.key}>
            {statusLine.label}
          </span>
          {supportSnapshot ? (
            <>
              <button type="button" onClick={() => void copySupportSnapshot()} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                Kopier
              </button>
              {supportCopyFeedback === "ok" && <span className="text-xs text-green-700">Kopiert</span>}
              {supportCopyFeedback === "fail" && <span className="text-xs text-slate-500">Kunne ikke kopiere</span>}
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusLine.actions.reload && !isOffline ? (
            <button
              type="button"
              onClick={reloadDetailFromServer}
              disabled={isOffline}
              title={isOffline ? "Du er offline" : undefined}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Last på nytt
            </button>
          ) : null}
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-center">
        <p className="text-sm text-amber-800">Last serverversjon på nytt for å fortsette.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reloadDetailFromServer}
            disabled={isOffline}
            title={isOffline ? "Du er offline" : undefined}
            className="rounded-lg border border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Last på nytt
          </button>
          <button
            type="button"
            onClick={() => guardPush("/backoffice/content")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Tilbake til oversikt
          </button>
        </div>
      </div>
    </>
  );
}
