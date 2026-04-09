"use client";

/**
 * Full-width preview canvas branch (device + historikk-preview). Ingen editor-logikk.
 */

import { motion } from "framer-motion";
import { PreviewCanvas, type PreviewDeviceId } from "./PreviewCanvas";
import type { HistoryPreviewPayload } from "./ContentPageVersionHistory";
import type { Block } from "./editorBlockTypes";

export type ContentWorkspacePreviewPaneProps = {
  previewDevice: PreviewDeviceId;
  historyPreviewBlocks: Block[] | null;
  displayBlocks: Block[];
  historyVersionPreview: HistoryPreviewPayload | null;
  title: string;
  slug: string | null;
  pageSlug: string | null | undefined;
  effectiveId: string | null;
  /** Resolved for historikk vs gjeldende utkast — samme som LivePreviewPanel. */
  pageCmsMetaForPreview: Record<string, unknown>;
};

export function ContentWorkspacePreviewPane({
  previewDevice,
  historyPreviewBlocks,
  displayBlocks,
  historyVersionPreview,
  title,
  slug,
  pageSlug,
  effectiveId,
  pageCmsMetaForPreview,
}: ContentWorkspacePreviewPaneProps) {
  return (
    <motion.div
      key="canvas-full-preview"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="min-w-0 cursor-default"
    >
      <PreviewCanvas
        device={previewDevice}
        blocks={historyPreviewBlocks ?? displayBlocks}
        title={(historyVersionPreview?.title ?? title).trim()}
        meta={{
          slug: String(historyVersionPreview?.slug ?? slug ?? pageSlug ?? ""),
        }}
        pageCmsMeta={pageCmsMetaForPreview}
        pageId={effectiveId}
      />
    </motion.div>
  );
}
