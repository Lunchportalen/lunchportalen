"use client";

import type { PreviewDeviceId } from "./PreviewCanvas";
import type { BackofficeContentEntityWorkspaceViewId } from "@/lib/cms/backofficeExtensionRegistry";

type MainView = BackofficeContentEntityWorkspaceViewId;

export type ContentWorkspaceEditorModeStripProps = {
  canvasMode: "preview" | "edit";
  mainView: MainView;
  title: string;
  setTitle: (v: string) => void;
  setMainView: (v: MainView) => void;
  setCanvasMode: (m: "preview" | "edit") => void;
  previewDevice: PreviewDeviceId;
  setPreviewDevice: (d: PreviewDeviceId) => void;
  formatDate: (v: string | null | undefined) => string;
  pageUpdatedAt: string | null | undefined;
  pageId: string;
  canOpenPublic: boolean;
  onOpenPublicPage: () => void;
  publishReadiness: boolean;
};

/**
 * Title field (edit vs preview read-only) + mode / device toolbar + status row.
 * Extracted from ContentWorkspaceEditorChrome for maintainability; behavior unchanged.
 */
export function ContentWorkspaceEditorModeStrip(props: ContentWorkspaceEditorModeStripProps) {
  const {
    mainView,
    title,
    setTitle,
    previewDevice,
    setPreviewDevice,
    formatDate,
    pageUpdatedAt,
    pageId,
    canOpenPublic,
    onOpenPublicPage,
    publishReadiness,
  } = props;
  const modeExplanation =
    mainView === "preview"
      ? "Samme pipeline som den offentlige siden, uten editorstøy."
      : mainView === "history"
        ? "Versjoner, audit og governance samles i én egen arbeidsflate."
        : mainView === "global"
          ? "Globale innstillinger og delte flater ligger utenfor sideeditoren."
          : mainView === "design"
            ? "Sidevisning, layout og design scopes ligger i egen arbeidsflate."
            : "Rediger i midten, med struktur til venstre og inspector til høyre.";

  return (
    <>
      <p className="text-xs text-[rgb(var(--lp-muted))]">{modeExplanation}</p>
      {mainView === "content" ? (
        <label className="block">
          <span className="sr-only">Sidetittel</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sidetittel (f.eks. Hjem)"
            className="mt-1.5 w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2.5 text-base font-medium text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
          />
        </label>
      ) : (
        <p className="mt-1.5 rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/25 px-3 py-2.5 text-sm text-[rgb(var(--lp-muted))]">
          {mainView === "preview"
            ? "Forhåndsvisning er skrivebeskyttet."
            : mainView === "history"
              ? "Historikk-flaten er skrivebeskyttet."
              : "Denne arbeidsflaten er skrivebeskyttet."}{" "}
          Tittel:{" "}
          <span className="font-medium text-[rgb(var(--lp-text))]">{title.trim() || "—"}</span>
        </p>
      )}

      <div className="flex flex-col gap-2 border-b border-[rgb(var(--lp-border))] bg-white px-2 py-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <span className="inline-flex min-h-9 items-center rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/35 px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-muted))]">
            {mainView === "preview"
              ? "Preview styres fra workspace-visningen"
              : mainView === "history"
                ? "Historikk er egen workspace-visning"
                : "Editoren styres fra aktiv workspace-fane"}
          </span>
          {mainView === "preview" ? (
            <div
              className="inline-flex w-fit flex-wrap rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/35 p-0.5"
              role="group"
              aria-label="Enhet"
            >
              {(
                [
                  ["desktop", "Datamaskin"],
                  ["tablet", "Nettbrett"],
                  ["mobile", "Mobil"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreviewDevice(id)}
                  className={`min-h-9 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    previewDevice === id
                      ? "bg-white text-[rgb(var(--lp-text))] shadow-sm ring-1 ring-pink-500/25"
                      : "text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <span className="tabular-nums">Oppdatert {formatDate(pageUpdatedAt)}</span>
            {canOpenPublic && (
              <button
                type="button"
                onClick={onOpenPublicPage}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]/60"
              >
                <span aria-hidden>↗</span>
                <span>Åpne offentlig side</span>
              </button>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                publishReadiness
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900"
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-current opacity-90" aria-hidden />
              {publishReadiness ? "Klar til publisering" : "Mangler innhold"}
            </span>
            {pageId.length >= 8 ? (
              <span className="hidden text-xs text-[rgb(var(--lp-muted))] lg:inline" title={`Side-ID ${pageId}`}>
                ID {pageId.slice(0, 8)}…
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
