"use client";

/**
 * Dev-only HUD — flyttet ut av `ContentWorkspace` for lavere parent-støy (ingen atferdsendring).
 */

type Metrics = { errors: number; actions: number };

export function ContentWorkspaceDevDebugOverlays(props: {
  isDev: boolean;
  metrics: Metrics;
  selectedBlockId: string | null;
  effectiveId: string | null;
}) {
  const { isDev, metrics, selectedBlockId, effectiveId } = props;
  return (
    <>
      {isDev && metrics.errors > 0 ? (
        <div
          className="pointer-events-none fixed top-2 right-2 z-[9998] rounded bg-red-100 px-2 py-1 text-xs text-red-700"
          aria-live="polite"
        >
          {metrics.errors} feil
        </div>
      ) : null}
      {isDev ? (
        <div className="fixed bottom-2 left-2 z-[9998] max-w-[min(100vw-1rem,16rem)] rounded bg-black p-2 font-mono text-[10px] text-white opacity-90">
          <div>Block: {selectedBlockId ?? "—"}</div>
          <div>Node: {effectiveId ?? "—"}</div>
          <div>Errors: {metrics.errors}</div>
        </div>
      ) : null}
      {isDev ? (
        <div className="fixed bottom-2 right-2 z-[9998] rounded bg-black p-2 font-mono text-[10px] text-white opacity-90">
          <div>Actions: {metrics.actions}</div>
          <div>Errors: {metrics.errors}</div>
        </div>
      ) : null}
    </>
  );
}
