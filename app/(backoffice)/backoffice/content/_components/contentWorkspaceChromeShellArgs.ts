"use client";

/**
 * Typed args-/factory-hjelpere for chrome-shell / tri-pane wiring.
 * Ren pass-through til eksisterende `chromeShell*` / `visualInlineEditApi`-kontrakt — ingen ny forretningslogikk.
 */

import { useMemo, type MutableRefObject } from "react";
import type { Block } from "./editorBlockTypes";
import { workspaceFieldHintsForBlock } from "./contentWorkspace.blockRegistry";
import type { HistoryPreviewPayload } from "./ContentPageVersionHistory";
import type { PublicPageVisualInlineEdit } from "./PreviewCanvas";
import type { ContentWorkspaceMediaPickerTarget } from "./contentWorkspaceModalShellProps";

export function buildVisualPreviewFieldHintsMap(
  blocksForLivePreview: Block[],
  selectedBlockId: string | null
): Record<string, Record<string, string>> | undefined {
  if (!selectedBlockId) return undefined;
  const b = blocksForLivePreview.find((x) => x.id === selectedBlockId);
  if (!b) return undefined;
  const hints = workspaceFieldHintsForBlock(b);
  return hints ? { [b.id]: hints } : undefined;
}

export type VisualInlineEditChromeShellParams = {
  showPreview: boolean;
  historyVersionPreview: HistoryPreviewPayload | null;
  blocks: Block[];
  visualPreviewFieldHints: Record<string, Record<string, string>> | undefined;
  visualPatchPendingRef: MutableRefObject<Record<string, Record<string, unknown>>>;
  visualPatchTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  flushVisualCanvasPatches: () => void;
  onDeleteBlock: (id: string) => void;
  setMediaPickerTarget: (v: ContentWorkspaceMediaPickerTarget) => void;
  setMediaPickerOpen: (v: boolean) => void;
  setEditIndex: (v: number | null) => void;
  setEditOpen: (v: boolean) => void;
};

export function buildVisualInlineEditApiForChromeShell(
  p: VisualInlineEditChromeShellParams
): PublicPageVisualInlineEdit | null {
  if (!p.showPreview || p.historyVersionPreview) return null;
  return {
    enabled: true,
    onPatchBlock: (blockId: string, patch: Record<string, unknown>) => {
      p.visualPatchPendingRef.current[blockId] = {
        ...(p.visualPatchPendingRef.current[blockId] ?? {}),
        ...patch,
      };
      if (p.visualPatchTimerRef.current) clearTimeout(p.visualPatchTimerRef.current);
      p.visualPatchTimerRef.current = setTimeout(() => {
        p.visualPatchTimerRef.current = null;
        p.flushVisualCanvasPatches();
      }, 140);
    },
    onRemoveBlock: p.onDeleteBlock,
    onReplaceHeroBleedImage: (blockId: string, which: "background" | "overlay") => {
      p.setMediaPickerTarget({
        blockId,
        field: which === "background" ? "heroBleedBackground" : "heroBleedOverlay",
      });
      p.setMediaPickerOpen(true);
    },
    onOpenAdvancedEditor: (blockId: string) => {
      const i = p.blocks.findIndex((x) => x.id === blockId);
      if (i < 0) return;
      p.setEditIndex(i);
      p.setEditOpen(true);
    },
    fieldHintsByBlockId: p.visualPreviewFieldHints,
  };
}

export type ChromeVisualPreviewShellPairParams = {
  showPreview: boolean;
  historyVersionPreview: HistoryPreviewPayload | null;
  blocks: Block[];
  blocksForLivePreview: Block[];
  selectedBlockId: string | null;
  visualPatchPendingRef: MutableRefObject<Record<string, Record<string, unknown>>>;
  visualPatchTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  flushVisualCanvasPatches: () => void;
  onDeleteBlock: (id: string) => void;
  setMediaPickerTarget: (v: ContentWorkspaceMediaPickerTarget) => void;
  setMediaPickerOpen: (v: boolean) => void;
  setEditIndex: (v: number | null) => void;
  setEditOpen: (v: boolean) => void;
};

export function useChromeVisualPreviewShellPair(p: ChromeVisualPreviewShellPairParams): {
  visualPreviewFieldHints: Record<string, Record<string, string>> | undefined;
  visualInlineEditApi: PublicPageVisualInlineEdit | null;
} {
  const visualPreviewFieldHints = useMemo(
    () => buildVisualPreviewFieldHintsMap(p.blocksForLivePreview, p.selectedBlockId),
    [p.blocksForLivePreview, p.selectedBlockId]
  );

  const visualInlineEditApi = useMemo(
    () =>
      buildVisualInlineEditApiForChromeShell({
        showPreview: p.showPreview,
        historyVersionPreview: p.historyVersionPreview,
        blocks: p.blocks,
        visualPreviewFieldHints,
        visualPatchPendingRef: p.visualPatchPendingRef,
        visualPatchTimerRef: p.visualPatchTimerRef,
        flushVisualCanvasPatches: p.flushVisualCanvasPatches,
        onDeleteBlock: p.onDeleteBlock,
        setMediaPickerTarget: p.setMediaPickerTarget,
        setMediaPickerOpen: p.setMediaPickerOpen,
        setEditIndex: p.setEditIndex,
        setEditOpen: p.setEditOpen,
      }),
    [
      p.showPreview,
      p.historyVersionPreview,
      p.blocks,
      visualPreviewFieldHints,
      p.flushVisualCanvasPatches,
      p.onDeleteBlock,
      p.setMediaPickerTarget,
      p.setMediaPickerOpen,
      p.setEditIndex,
      p.setEditOpen,
    ]
  );

  return { visualPreviewFieldHints, visualInlineEditApi };
}

export function useContentWorkspaceUrlModeFlags(): {
  isPitch: boolean;
  isWow: boolean;
  isDemo: boolean;
} {
  const isPitch = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.search.includes("pitch=1");
  }, []);
  const isWow = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.search.includes("wow=1");
  }, []);
  const isDemo = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.search.includes("demo=1") || isWow || isPitch;
  }, [isWow, isPitch]);
  return { isPitch, isWow, isDemo };
}
