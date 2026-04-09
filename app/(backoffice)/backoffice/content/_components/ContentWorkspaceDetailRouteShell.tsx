"use client";

/**
 * Små route-/tilstandsskall for innholds-redigeringsgrenen (samme markup som før).
 */

export function ContentWorkspaceEmptySelectionShell() {
  return (
    <>
      <h1 className="text-xl font-semibold text-[rgb(var(--lp-text))]">Velg en side for å redigere</h1>
      <div className="mt-4 rounded-lg border border-[rgb(var(--lp-border))] bg-white p-6 text-center">
        <p className="text-sm text-[rgb(var(--lp-muted))]">Velg side i listen til venstre</p>
      </div>
    </>
  );
}

export function ContentWorkspacePageNotFoundShell(props: { onBackToOverview: () => void }) {
  const { onBackToOverview } = props;
  return (
    <div className="mt-4 rounded-lg border border-[rgb(var(--lp-border))] bg-white p-4 text-center">
      <h2 className="text-lg font-semibold text-[rgb(var(--lp-text))]">Siden finnes ikke</h2>
      <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Den kan ha blitt slettet eller flyttet.</p>
      <button
        type="button"
        onClick={onBackToOverview}
        className="mt-4 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
      >
        Tilbake til oversikt
      </button>
    </div>
  );
}

export function ContentWorkspaceDetailLoadingShell() {
  return (
    <div className="mt-4 rounded-lg border border-[rgb(var(--lp-border))] bg-white p-4 text-sm text-[rgb(var(--lp-muted))]">
      Loading page...
    </div>
  );
}

export function ContentWorkspaceDetailErrorShell(props: { message: unknown }) {
  return (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {String(props.message ?? "")}
    </div>
  );
}

export function ContentWorkspaceEditorAreaLoadingShell() {
  return (
    <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-white p-4 text-center text-sm text-[rgb(var(--lp-muted))]">
      Laster redigeringsområde…
    </div>
  );
}

export type ContentWorkspaceGlobalPanelTab = "content" | "info";

export function ContentWorkspaceGlobalPanelTabPlaceholder(props: { tab: ContentWorkspaceGlobalPanelTab }) {
  const copy =
    props.tab === "content" ? "Content-fane. Kommer snart." : "Info-fane. Kommer snart.";
  return <p className="text-sm text-[rgb(var(--lp-muted))]">{copy}</p>;
}
