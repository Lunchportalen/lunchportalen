"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

export type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

function BlockPreviewSkeleton() {
  return (
    <div className="space-y-2 py-1" aria-hidden>
      <div className="h-3 w-[72%] max-w-md animate-pulse rounded bg-slate-200/85" />
      <div className="h-3 w-[48%] max-w-sm animate-pulse rounded bg-slate-200/75" />
    </div>
  );
}

const BlockCollapsedPreviewLazy = dynamic(
  () =>
    import("@/app/(backoffice)/backoffice/content/_components/BlockCollapsedPreview").then((m) => ({
      default: m.BlockCollapsedPreview,
    })),
  { loading: () => <BlockPreviewSkeleton /> },
);

function BlockPreviewInner({ block }: { block: Block }) {
  return <BlockCollapsedPreviewLazy block={block} />;
}

/**
 * Collapsed block preview in the CMS list (lazy-loaded per-type rendering).
 */
export const BlockPreview = React.memo(BlockPreviewInner);
BlockPreviewInner.displayName = "BlockPreview";
