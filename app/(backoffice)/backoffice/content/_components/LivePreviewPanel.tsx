"use client";

import { PublicPageRenderer, type PublicPageVisualInlineEdit } from "./PreviewCanvas";

type LivePreviewPanelProps = {
  pageTitle: string;
  blocks: Array<{ id: string; type: string } & Record<string, unknown>>;
  /** Body `meta` for layered design — same merge as published (`buildEffectiveParsedDesignSettingsLayered`). */
  pageCmsMeta?: Record<string, unknown> | null;
  pageId?: string | null;
  variantId?: string | null;
  /** Selected block id used to keep preview in sync with editor/structure tree. */
  selectedBlockId?: string | null;
  /** Click handler for blocks in preview (drives editor selection + scroll). */
  onSelectBlock?: (blockId: string) => void;
  hoverBlockId?: string | null;
  onHoverBlock?: (blockId: string | null) => void;
  /** Inline editing on preview (optional). */
  visualInlineEdit?: PublicPageVisualInlineEdit | null;
  /** Explicit preview source, e.g. "Utkast" */
  previewSourceLabel?: string;
  /** True when current draft body differs from published (prod) body */
  previewDiffersFromPublished?: boolean;
  /** True when page has a published (prod) variant */
  hasPublishedVersion?: boolean;
  /** True when published-body fetch has completed (so we can show "no published" vs loading) */
  publishedBodyFetched?: boolean;
};

/** Live forhåndsvisning: same pipeline as public [slug] via `PublicPageRenderer`. */
export function LivePreviewPanel({
  pageTitle,
  blocks,
  pageCmsMeta = null,
  pageId = null,
  variantId = null,
  selectedBlockId = null,
  onSelectBlock,
  hoverBlockId = null,
  onHoverBlock,
  visualInlineEdit = null,
  previewSourceLabel,
  previewDiffersFromPublished,
  hasPublishedVersion,
  publishedBodyFetched,
}: LivePreviewPanelProps) {
  return (
    <aside
      className="lg:sticky lg:top-4 h-fit rounded-lg border-0 bg-transparent p-0"
      aria-label="Live forhåndsvisning av siden"
    >
      <div className="font-ui mb-2 space-y-1 text-[11px] text-[rgb(var(--lp-muted))]">
        {previewSourceLabel != null && previewSourceLabel !== "" && (
          <p aria-live="polite">Kilde: {previewSourceLabel}</p>
        )}
        {publishedBodyFetched && !hasPublishedVersion && (
          <p className="text-amber-700" aria-live="polite">
            Ingen publisert versjon ennå.
          </p>
        )}
        {publishedBodyFetched && hasPublishedVersion && previewDiffersFromPublished && (
          <p className="text-amber-700" aria-live="polite">
            Avviker fra publisert versjon.
          </p>
        )}
        {publishedBodyFetched && hasPublishedVersion && !previewDiffersFromPublished && (
          <p aria-live="polite">Publisert: samme som på nettsiden.</p>
        )}
      </div>
      <div
        className={`mx-auto w-full space-y-3 rounded-lg border border-[rgb(var(--lp-border))] bg-white/90 p-4 shadow-sm ${
          visualInlineEdit?.enabled ? "max-w-3xl" : "max-w-2xl"
        }`}
      >
        <PublicPageRenderer
          blocks={blocks}
          title={pageTitle}
          pageCmsMeta={pageCmsMeta}
          pageId={pageId}
          variantId={variantId}
          onSelectBlock={onSelectBlock}
          selectedBlockId={selectedBlockId}
          hoverBlockId={hoverBlockId}
          onHoverBlock={onHoverBlock}
          visualInlineEdit={visualInlineEdit}
        />
      </div>
    </aside>
  );
}
