"use client";

import { ContentWorkspacePreviewPane } from "./ContentWorkspacePreviewPane";
import type { HistoryPreviewPayload } from "./ContentPageVersionHistory";
import type { Block } from "./editorBlockTypes";
import type { PreviewDeviceId } from "./PreviewCanvas";
import type { BodyMode } from "./contentWorkspace.blocks";

export type WorkspacePreviewProps = {
  previewDevice: PreviewDeviceId;
  bodyMode: BodyMode;
  bodyParseError: string | null;
  historyPreviewBlocks: Block[] | null;
  displayBlocks: Block[];
  historyVersionPreview: HistoryPreviewPayload | null;
  title: string;
  slug: string | null;
  pageSlug: string | null | undefined;
  effectiveId: string | null;
  pageCmsMetaForPreview: Record<string, unknown>;
};

export function WorkspacePreview({
  previewDevice,
  bodyMode,
  bodyParseError,
  historyPreviewBlocks,
  displayBlocks,
  historyVersionPreview,
  title,
  slug,
  pageSlug,
  effectiveId,
  pageCmsMetaForPreview,
}: WorkspacePreviewProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[rgb(var(--lp-border))]/80 bg-white p-3 sm:p-4">
        {historyVersionPreview ? (
          <div
            className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2"
            role="status"
            aria-live="polite"
          >
            <p className="text-xs font-medium text-amber-950">
              Historikk-preview: {historyVersionPreview.versionLabel}
            </p>
          </div>
        ) : null}

        {bodyMode === "legacy" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Konverter body til blokker for a bruke den dedikerte preview-flaten.
          </div>
        ) : bodyMode === "invalid" ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {bodyParseError || "Ugyldig body-format. Reset til blokker for a aktivere preview."}
          </div>
        ) : (
          <ContentWorkspacePreviewPane
            previewDevice={previewDevice}
            historyPreviewBlocks={historyPreviewBlocks}
            displayBlocks={displayBlocks}
            historyVersionPreview={historyVersionPreview}
            title={title}
            slug={slug}
            pageSlug={pageSlug}
            effectiveId={effectiveId}
            pageCmsMetaForPreview={pageCmsMetaForPreview}
          />
        )}
      </div>
    </div>
  );
}
