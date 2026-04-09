"use client";

import type { Dispatch, SetStateAction } from "react";
import { getOutboxEntryKey, getOutboxUiStatus, type OutboxEntry } from "./contentWorkspace.outbox";

export type ContentWorkspaceOutboxRecoveryBannerProps = {
  recoveryBannerVisible: boolean;
  outboxData: OutboxEntry | null;
  hasFingerprintConflict: boolean;
  outboxDetailsExpanded: boolean;
  setOutboxDetailsExpanded: Dispatch<SetStateAction<boolean>>;
  copyOutboxSafetyExport: (entry: OutboxEntry) => void;
  outboxCopyFeedback: Record<string, "ok" | "fail" | undefined>;
  onRestoreOutbox: () => void;
  onDiscardOutbox: () => void;
  formatDate: (v: string | null | undefined) => string;
};

export function ContentWorkspaceOutboxRecoveryBanner(props: ContentWorkspaceOutboxRecoveryBannerProps) {
  const {
    recoveryBannerVisible,
    outboxData,
    hasFingerprintConflict,
    outboxDetailsExpanded,
    setOutboxDetailsExpanded,
    copyOutboxSafetyExport,
    outboxCopyFeedback,
    onRestoreOutbox,
    onDiscardOutbox,
    formatDate,
  } = props;

  if (!recoveryBannerVisible || !outboxData) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
    >
      {hasFingerprintConflict && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          Serveren har nyere versjon. Gjenoppretting er deaktivert.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {(() => {
            const st = getOutboxUiStatus(outboxData);
            const toneClass =
              st.tone === "danger"
                ? "border-red-300 bg-red-50 text-red-800"
                : st.tone === "warn"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-300 bg-slate-50 text-slate-700";
            return (
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>{st.label}</span>
            );
          })()}
          <span className="font-medium">Ulagret utkast funnet.</span>
          <span className="text-amber-800">
            {outboxData.savedAtLocal
              ? `Sist forsøkt: ${formatDate(outboxData.savedAtLocal)}`
              : "Tid: ukjent"}
            {outboxData.updatedAtSeen ? ` · Sist sett på server: ${formatDate(outboxData.updatedAtSeen)}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOutboxDetailsExpanded((v) => !v)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {outboxDetailsExpanded ? "Skjul detaljer" : "Vis detaljer"}
          </button>
          <button
            type="button"
            onClick={() => copyOutboxSafetyExport(outboxData)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Kopier
          </button>
          {outboxCopyFeedback[getOutboxEntryKey(outboxData)] === "ok" && (
            <span className="text-xs text-green-700">Kopiert</span>
          )}
          {outboxCopyFeedback[getOutboxEntryKey(outboxData)] === "fail" && (
            <span className="text-xs text-slate-500">Kunne ikke kopiere</span>
          )}
          <button
            type="button"
            onClick={onRestoreOutbox}
            disabled={hasFingerprintConflict}
            className="rounded-lg border border-amber-500 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Gjenopprett
          </button>
          <button
            type="button"
            onClick={onDiscardOutbox}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Forkast
          </button>
        </div>
      </div>
      {outboxDetailsExpanded && (
        <div className="mt-3 space-y-2 border-t border-amber-200 pt-3 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
            <span className="text-amber-800">pageId</span>
            <span className="font-mono">{outboxData.pageId}</span>
            <span className="text-amber-800">savedAtLocal</span>
            <span>{formatDate(outboxData.savedAtLocal)}</span>
            <span className="text-amber-800">updatedAtSeen</span>
            <span>{outboxData.updatedAtSeen ? formatDate(outboxData.updatedAtSeen) : "—"}</span>
            <span className="text-amber-800">fingerprint</span>
            <span className="font-mono truncate" title={outboxData.fingerprint}>
              {outboxData.fingerprint}
            </span>
            <span className="text-amber-800">draft.title</span>
            <span>{outboxData.draft.title || "—"}</span>
            <span className="text-amber-800">draft.slug</span>
            <span>{outboxData.draft.slug || "—"}</span>
            <span className="text-amber-800">draft.status</span>
            <span>{outboxData.draft.status}</span>
          </div>
          <div>
            <div className="mb-1 font-medium text-amber-800">draft (body som JSON)</div>
            <pre className="max-h-64 overflow-auto rounded border border-amber-200 bg-white p-2 font-mono text-xs text-slate-800">
              {JSON.stringify(outboxData.draft, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
