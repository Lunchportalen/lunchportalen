import type { StatusLineState, SupportSnapshot } from "./types";

type SupportCopyFeedback = "ok" | "fail" | null;

type ContentConflictPanelProps = {
  statusLine: StatusLineState;
  supportSnapshot: SupportSnapshot | null;
  supportCopyFeedback: SupportCopyFeedback;
  isOffline: boolean;
  onCopySupportSnapshot: () => void | Promise<void>;
  onReloadFromServer: () => void | Promise<void>;
  onBackToOverview: () => void | Promise<void>;
};

export function ContentConflictPanel({
  statusLine,
  supportSnapshot,
  supportCopyFeedback,
  isOffline,
  onCopySupportSnapshot,
  onReloadFromServer,
  onBackToOverview,
}: ContentConflictPanelProps) {
  return (
    <>
      {/* I1 – statuslinje over konfliktpanelet */}
      <div
        role="status"
        className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm text-[rgb(var(--lp-text))]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${statusLine.tone}`}
            key={statusLine.key}
          >
            {statusLine.label}
          </span>
          {supportSnapshot && (
            <>
              {/* I4 – Kopier support-snapshot */}
              <button
                type="button"
                onClick={() => void onCopySupportSnapshot()}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Kopier
              </button>
              {supportCopyFeedback === "ok" && (
                <span className="text-xs text-green-700">Kopiert</span>
              )}
              {supportCopyFeedback === "fail" && (
                <span className="text-xs text-slate-500">Kunne ikke kopiere</span>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusLine.actions.reload && !isOffline && (
            <button
              type="button"
              onClick={onReloadFromServer}
              disabled={isOffline}
              title={isOffline ? "Du er offline" : undefined}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Last på nytt
            </button>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-center">
        <p className="text-sm font-medium text-amber-800">
          Konflikt: siden er endret av en annen eller av serveren.
        </p>
        <p className="mt-1 text-xs text-amber-700">
          Last siden på nytt for å hente nyeste versjon. Du kan kopiere innhold over først hvis du vil beholde noe.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onReloadFromServer}
            disabled={isOffline}
            title={isOffline ? "Du er offline" : "Last siden på nytt"}
            aria-label="Last siden på nytt"
            className="rounded-lg border border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Last på nytt
          </button>
          <button
            type="button"
            onClick={onBackToOverview}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Tilbake til oversikt
          </button>
        </div>
      </div>
    </>
  );
}

