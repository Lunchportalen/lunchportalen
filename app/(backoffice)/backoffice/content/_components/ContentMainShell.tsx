"use client";

import { LayoutThumbnail } from "./LayoutThumbnail";
import { BlockInspectorShell } from "./BlockInspectorShell";
import { LivePreviewPanel } from "./LivePreviewPanel";

// Narrow, presentational wrapper for the main content shell (document/layout + blocks + preview).
// All state and business logic live in ContentWorkspace and are passed in via props.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContentMainShellProps = any;

export function ContentMainShell({
  showPreview,
  title,
  documentTypeAlias,
  setDocumentTypeAlias,
  documentTypes,
  setEnvelopeFields,
  meta,
  setMeta,
  safeStr,
  safeObj,
  bodyMode,
  bodyParseError,
  onConvertLegacyBody,
  onResetInvalidBody,
  showBlocks,
  showPreviewColumn,
  setShowPreviewColumn,
  blockValidationError,
  blocks,
  expandedBlockId,
  onToggleBlock,
  setBlockById,
  blocksValidation,
  onMoveBlock,
  onDeleteBlock,
  setEditOpen,
  setEditIndex,
  openMediaPicker,
  blockTypeSubtitle,
  makeBlockId,
  addInsertIndexRef,
  setBlockPickerOpen,
  isForside,
  onFillForsideFromRepo,
  heroImageSuggestions,
  handleHeroImageSuggestions,
  applyHeroImageSuggestion,
  isOffline,
  effectiveId,
  aiBusyToolId,
  handleAiStructuredIntent,
  selectedBannerItemId,
  setSelectedBannerItemId,
  bannerPanelTab,
  setBannerPanelTab,
  bannerSettingsSubTab,
  setBannerSettingsSubTab,
  bannerVisualOptions,
  handleBannerVisualOptions,
  handleFetchImageAltFromArchive,
  onOpenCtaAi,
  aiDisabled,
  onInlineAiImprove,
  onInlineAiRewrite,
  onInlineAiExpand,
  inlineAiBusy,
  onInsertAiBlockClick,
  previewDiffersFromPublished,
  hasPublishedVersion,
  publishedBodyFetched,
}: ContentMainShellProps) {
  return (
    <div
      className={`lp-motion-card space-y-3 rounded-b-lg rounded-t-lg border border-t-0 border-[rgb(var(--lp-border))] bg-white p-3 ${
        showPreview
          ? "lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-4 lg:items-start"
          : ""
      }`}
    >
      <div className="space-y-4 min-w-0">
        {/* Page setup */}
        <section className="lp-motion-card space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 p-3">
          {/* Umbraco Core Patch A – Document Type (single source of truth) */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Document Type
            </h3>
            <div className="border-b border-[rgb(var(--lp-border))]" aria-hidden />
            <div className="pt-1">
              <label htmlFor="doc-type-select" className="sr-only">
                Dokumenttype
              </label>
              <select
                id="doc-type-select"
                value={documentTypeAlias ?? ""}
                onChange={(e) => {
                  const next = e.target.value.trim() || null;
                  setDocumentTypeAlias(next);
                  if (next !== documentTypeAlias) setEnvelopeFields({});
                }}
                className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
                aria-label="Velg dokumenttype"
              >
                <option value="">— Ingen dokumenttype —</option>
                {documentTypes.map((dt: any) => (
                  <option key={dt.alias} value={dt.alias}>
                    {dt.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
                Dokumenttypen styrer tillatte undernoder og egenskapsfelt.
              </p>
            </div>
          </div>
          {/* Layout / page chrome */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Layout
            </h3>
            <div className="border-b border-[rgb(var(--lp-border))]" aria-hidden />
            <div className="grid gap-2 pt-1">
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    ["full", "FULL"],
                    ["left", "LEFT"],
                    ["right", "RIGHT"],
                    ["centerNavLeft", "CENTER (NAV LEFT)"],
                    ["centerNavRight", "CENTER (NAV RIGHT)"],
                  ] as const
                ).map(([value, label]) => {
                  const currentLayout = safeStr((meta as { layout?: unknown }).layout) || "full";
                  const selected = currentLayout === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMeta((prev: any) => ({ ...prev, layout: value }))}
                      className={`lp-motion-card flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 ${
                        selected
                          ? "border-slate-400 bg-slate-50"
                          : "border-[rgb(var(--lp-border))] bg-white hover:border-slate-300"
                      }`}
                      title={label}
                    >
                      <LayoutThumbnail layout={value as any} />
                      <span className="text-xs font-medium text-[rgb(var(--lp-text))]">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-[rgb(var(--lp-muted))]">Skjul sidetitler</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(safeObj(meta).hidePageHeadings)}
                  onClick={() =>
                    setMeta((prev: any) => ({
                      ...prev,
                      hidePageHeadings: !safeObj(prev).hidePageHeadings,
                    }))
                  }
                  className={`lp-motion-switch relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 ${
                    safeObj(meta).hidePageHeadings
                      ? "border-slate-500 bg-slate-500"
                      : "border-[rgb(var(--lp-border))] bg-slate-200"
                  }`}
                >
                  <span
                    className={`lp-motion-switch-thumb pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ${
                      safeObj(meta).hidePageHeadings ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-xs font-medium text-[rgb(var(--lp-muted))]">
                  {safeObj(meta).hidePageHeadings ? "JA" : "NEI"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Main content / blocks */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                Main content
              </h3>
              <p className="mt-0.5 text-[11px] text-[rgb(var(--lp-muted))]">
                Bygg siden blokk for blokk. Rekkefølgen her er rekkefølgen på den offentlige siden.
              </p>
            </div>
            {showBlocks && (
              <button
                type="button"
                onClick={() => setShowPreviewColumn((v: boolean) => !v)}
                className="whitespace-nowrap text-xs text-[rgb(var(--lp-muted))] underline hover:text-[rgb(var(--lp-text))]"
              >
                {showPreviewColumn ? "Skjul forhåndsvisning" : "Vis forhåndsvisning"}
              </button>
            )}
          </div>
          <div className="border-b border-[rgb(var(--lp-border))]" aria-hidden />
          <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 p-3 pt-3">
            {bodyMode === "legacy" && (
              <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p>Legacy body detected. Convert to blocks to use builder.</p>
                <button
                  type="button"
                  onClick={onConvertLegacyBody}
                  className="min-h-[36px] rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium"
                >
                  Convert to blocks
                </button>
              </div>
            )}

            {bodyMode === "invalid" && (
              <div className="mt-3 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p>{bodyParseError || "Invalid body format."}</p>
                <button
                  type="button"
                  onClick={onResetInvalidBody}
                  className="min-h-[36px] rounded-lg border border-red-300 bg-white px-3 text-sm font-medium"
                >
                  Reset to blocks
                </button>
              </div>
            )}

            {showBlocks && (
              <div className="space-y-2">
                {blockValidationError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {blockValidationError}
                  </div>
                )}
                <BlockInspectorShell
                  blocks={blocks}
                  expandedBlockId={expandedBlockId}
                  onToggleBlock={onToggleBlock}
                  setBlockById={setBlockById}
                  blocksValidation={blocksValidation}
                  onMoveBlock={onMoveBlock}
                  onDeleteBlock={onDeleteBlock}
                  setEditOpen={setEditOpen}
                  setEditIndex={setEditIndex}
                  openMediaPicker={openMediaPicker}
                  blockTypeSubtitle={blockTypeSubtitle}
                  makeBlockId={makeBlockId}
                  onAddBlockClick={() => {
                    addInsertIndexRef.current = blocks.length;
                    setBlockPickerOpen(true);
                  }}
                  isForsidePage={isForside}
                  onFillForsideFromRepo={onFillForsideFromRepo}
                  heroImageSuggestions={heroImageSuggestions}
                  handleHeroImageSuggestions={handleHeroImageSuggestions}
                  applyHeroImageSuggestion={applyHeroImageSuggestion}
                  isOffline={isOffline}
                  effectiveId={effectiveId}
                  aiBusyToolId={aiBusyToolId}
                  handleAiStructuredIntent={handleAiStructuredIntent}
                  selectedBannerItemId={selectedBannerItemId}
                  setSelectedBannerItemId={setSelectedBannerItemId}
                  bannerPanelTab={bannerPanelTab}
                  setBannerPanelTab={setBannerPanelTab}
                  bannerSettingsSubTab={bannerSettingsSubTab}
                  setBannerSettingsSubTab={setBannerSettingsSubTab}
                  bannerVisualOptions={bannerVisualOptions}
                  handleBannerVisualOptions={handleBannerVisualOptions}
                  onFetchImageAltFromArchive={handleFetchImageAltFromArchive}
                  onOpenCtaAi={onOpenCtaAi}
                  aiDisabled={aiDisabled}
                  onInlineAiImprove={onInlineAiImprove}
                  onInlineAiRewrite={onInlineAiRewrite}
                  onInlineAiExpand={onInlineAiExpand}
                  inlineAiBusy={inlineAiBusy}
                  onInsertAiBlockClick={onInsertAiBlockClick}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {showPreview && (
        <div className="mt-4 rounded-lg border-t border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/60 py-2 pl-3 pr-2 lg:mt-0 lg:border-t-0 lg:border-l">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
            Forhåndsvisning
          </h3>
          <LivePreviewPanel
            pageTitle={title}
            blocks={blocks}
            pageId={effectiveId ?? undefined}
            variantId={undefined}
            previewSourceLabel="Utkast"
            previewDiffersFromPublished={previewDiffersFromPublished}
            hasPublishedVersion={hasPublishedVersion}
            publishedBodyFetched={publishedBodyFetched}
          />
        </div>
      )}

      {(bodyMode === "legacy" || bodyMode === "invalid") && (
        <aside
          className="lg:sticky lg:top-4 flex h-fit items-center rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-4"
          aria-label="Forhåndsvisning"
        >
          <p className="text-sm text-[rgb(var(--lp-muted))]">
            {bodyMode === "legacy"
              ? "Konverter til blokker for å se live forhåndsvisning."
              : "Ugyldig body. Bruk  ««Reset to blocks «» for å se forhåndsvisning."}
          </p>
        </aside>
      )}
    </div>
  );
}

