"use client";

import { Component, type ReactNode } from "react";
import { renderBlock } from "@/lib/public/blocks/renderBlock";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";

const PREVIEW_ENV: "prod" | "staging" = "staging";
const PREVIEW_LOCALE: "nb" | "en" = "nb";

type PreviewBlock = {
  id: string;
  type: string;
} & Record<string, unknown>;

/** Catches render errors for a single block and shows fallback so the rest of the preview still works. */
class BlockPreviewErrorBoundary extends Component<
  { children: ReactNode; blockId: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: true } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          role="status"
        >
          Kan ikke forhåndsvise denne blokken.
        </div>
      );
    }
    return this.props.children;
  }
}

type LivePreviewPanelProps = {
  pageTitle: string;
  blocks: PreviewBlock[];
  pageId?: string | null;
  variantId?: string | null;
  /** Selected block id used to keep preview in sync with editor/structure tree. */
  selectedBlockId?: string | null;
  /** Click handler for blocks in preview (drives editor selection + scroll). */
  onSelectBlock?: (blockId: string) => void;
  /** Explicit preview source, e.g. "Utkast" */
  previewSourceLabel?: string;
  /** True when current draft body differs from published (prod) body */
  previewDiffersFromPublished?: boolean;
  /** True when page has a published (prod) variant */
  hasPublishedVersion?: boolean;
  /** True when published-body fetch has completed (so we can show "no published" vs loading) */
  publishedBodyFetched?: boolean;
};

/** Live forhåndsvisning: same pipeline as public [slug] — normalizeBlockForRender → renderBlock. */
export function LivePreviewPanel({
  pageTitle,
  blocks,
  pageId = null,
  variantId = null,
  selectedBlockId = null,
  onSelectBlock,
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
      <div className="font-ui mb-2 text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
        Lunchportalen
      </div>
      {/* Preview confidence: explicit source and parity with published */}
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
      <div className="mx-auto max-w-md space-y-3 rounded-lg border border-[rgb(var(--lp-border))] bg-white/90 p-3">
        {pageTitle ? (
          <h1 className="lp-h1 mb-2 text-[rgb(var(--lp-text))]">{pageTitle}</h1>
        ) : null}
        {blocks.length === 0 ? (
          <p className="font-ui text-sm text-[rgb(var(--lp-muted))]">
            Legg til innhold for å se forhåndsvisning.
          </p>
        ) : (
          <div className="space-y-4">
            {blocks.map((block, index) => {
              const node = normalizeBlockForRender(block ?? null, index);
              return (
                <BlockPreviewErrorBoundary key={node.id} blockId={node.id}>
                  <div
                    data-block-id={block.id}
                    data-analytics-page-id={pageId ?? undefined}
                    data-analytics-variant-id={variantId ?? undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBlock?.(block.id);
                    }}
                    className={block.id === selectedBlockId ? "ring-2 ring-rose-200 rounded-md" : undefined}
                  >
                    {renderBlock(node, PREVIEW_ENV, PREVIEW_LOCALE)}
                  </div>
                </BlockPreviewErrorBoundary>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

