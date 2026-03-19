"use client";

type ContentRecoveryPanelProps = {
  outboxData: any;
  hasFingerprintConflict: boolean;
  formatDate: (value: string | null | undefined) => string;
  outboxDetailsExpanded: boolean;
  setOutboxDetailsExpanded: (updater: (v: boolean) => boolean) => void;
  outboxCopyFeedback: Record<string, "ok" | "fail" | null | undefined>;
  getOutboxEntryKey: (entry: any) => string;
  copyOutboxSafetyExport: (entry: any) => void;
  onRestoreOutbox: () => void;
  onDiscardOutbox: () => void;
};

export function ContentRecoveryPanel({
  outboxData,
  hasFingerprintConflict,
  formatDate,
  outboxDetailsExpanded,
  setOutboxDetailsExpanded,
  outboxCopyFeedback,
  getOutboxEntryKey,
  copyOutboxSafetyExport,
  onRestoreOutbox,
  onDiscardOutbox,
}: ContentRecoveryPanelProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
    >
      <p className="mb-2 text-xs text-amber-800">
        Du kan gjenopprette innholdet her eller kassere det.
      </p>
      {hasFingerprintConflict && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          Serveren har nyere versjon. Gjenoppretting er deaktivert.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {/* E2 – outbox status per item */}
          {(() => {
            const st = (window as any).getOutboxUiStatus
              ? (window as any).getOutboxUiStatus(outboxData)
              : null;
            if (!st) return null;
            const toneClass =
              st.tone === "danger"
                ? "border-red-300 bg-red-50 text-red-800"
                : st.tone === "warn"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-300 bg-slate-50 text-slate-700";
            return (
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
                {st.label}
              </span>
            );
          })()}
          <span className="font-medium">Ulagret utkast i nettleseren</span>
          <span className="text-amber-800">
            {outboxData.savedAtLocal
              ? `Sist forsøkt: ${formatDate(outboxData.savedAtLocal)}`
              : "Tid: ukjent"}
            {outboxData.updatedAtSeen
              ? ` · Sist sett på server: ${formatDate(outboxData.updatedAtSeen)}`
              : ""}
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
          {/* E1 – Kopier outbox snapshot */}
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

