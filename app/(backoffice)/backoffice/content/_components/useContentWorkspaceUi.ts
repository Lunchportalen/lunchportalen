/**
 * Workspace UI orchestration: block selection, preview/layout chrome,
 * inspector-facing Bellissima state, and panel-related side effects (scroll/focus).
 * Does not own editor data (blocks body) — consumes blocks + setters from useContentWorkspaceBlocks.
 */

"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { usePathname } from "next/navigation";
import {
  useBellissimaEntityWorkspaceViewState,
  useBellissimaWorkspacePresentationState,
  useBellissimaWorkspaceShellState,
} from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
import type { ContentBellissimaInspectorSectionId } from "@/lib/cms/backofficeWorkspaceContextModel";
import type { Block } from "./editorBlockTypes";
import type { BodyMode } from "./contentWorkspace.blocks";

/** Detail `/content/[id]`: center er enten struktur (liste) eller visuell (canvas) — uavhengig av blokkvalg. */
export type ContentDetailEditorMode = "structure" | "visual";

export type UseContentWorkspaceUiParams = {
  /** Canonical editable block list (single source of truth for values + save). */
  blocks: Block[];
  /** Read-only canvas projection (e.g. WOW before/after); never authoritative for mutations. */
  displayBlocks: Block[];
  bodyMode: BodyMode;
  editorCanvasRef: RefObject<HTMLElement | null>;
  deleteBlockCore: (blockId: string) => void;
};

export function useContentWorkspaceUi({
  blocks,
  displayBlocks,
  bodyMode,
  editorCanvasRef,
  deleteBlockCore,
}: UseContentWorkspaceUiParams) {
  const pathname = usePathname() ?? "";
  const detailRouteEntityId = useMemo(() => {
    const r = resolveBackofficeContentRoute(pathname);
    return r.kind === "detail" ? r.entityId : null;
  }, [pathname]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoverBlockId, setHoverBlockId] = useState<string | null>(null);
  const [detailEditorMode, setDetailEditorMode] = useState<ContentDetailEditorMode>("structure");

  const { activeView: mainView, setActiveView: setMainView } =
    useBellissimaEntityWorkspaceViewState();
  const { showPreviewColumn, setShowPreviewColumn, previewLayoutMode, setPreviewLayoutMode, previewDevice, setPreviewDevice } =
    useBellissimaWorkspacePresentationState();
  const canvasMode: "edit" | "preview" = mainView === "preview" ? "preview" : "edit";
  const setCanvasMode = useCallback(
    (mode: "edit" | "preview") => {
      setMainView(mode === "preview" ? "preview" : "content");
    },
    [setMainView]
  );
  const { activeInspectorSection, setActiveInspectorSection } =
    useBellissimaWorkspaceShellState();
  const setInspectorSection = useCallback<
    Dispatch<SetStateAction<ContentBellissimaInspectorSectionId>>
  >(
    (value) => {
      const next =
        typeof value === "function"
          ? (value as (current: ContentBellissimaInspectorSectionId) => ContentBellissimaInspectorSectionId)(
              activeInspectorSection,
            )
          : value;
      setActiveInspectorSection(next);
    },
    [activeInspectorSection, setActiveInspectorSection],
  );

  const showBlocks = bodyMode === "blocks";
  const showPreview = showBlocks && canvasMode === "preview";

  const selectedBlock = useMemo(() => {
    return blocks.find((b) => b.id === selectedBlockId) ?? null;
  }, [blocks, selectedBlockId]);

  /** U82B: Inspector always reads canonical `blocks` by id — never a divergent display-only list. */
  const selectedBlockForInspector = useMemo((): Block | null => {
    if (!selectedBlockId) return null;
    return blocks.find((b) => b.id === selectedBlockId) ?? null;
  }, [blocks, selectedBlockId]);

  const selectedBlockIndex = useMemo(() => {
    if (!selectedBlockId) return -1;
    const i = displayBlocks.findIndex((b) => b.id === selectedBlockId);
    if (i >= 0) return i;
    return blocks.findIndex((b) => b.id === selectedBlockId);
  }, [displayBlocks, blocks, selectedBlockId]);

  const onSelectBlockFromTree = useCallback<Dispatch<SetStateAction<string | null>>>((value) => {
    setSelectedBlockId((prev) => {
      const next = typeof value === "function" ? (value as (p: string | null) => string | null)(prev) : value;
      queueMicrotask(() => {
        if (typeof next === "string" && next.length > 0) {
          document.getElementById(`lp-editor-block-${next}`)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        }
      });
      return next;
    });
  }, []);

  const onDeleteBlock = useCallback(
    (blockId: string) => {
      setSelectedBlockId((sel) => (sel === blockId ? null : sel));
      deleteBlockCore(blockId);
    },
    [deleteBlockCore]
  );

  useEffect(() => {
    if (!selectedBlockId) return;
    const el = document.getElementById(`lp-editor-block-${selectedBlockId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    window.requestAnimationFrame(() => {
      if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    });
  }, [selectedBlockId]);

  useEffect(() => {
    if (canvasMode !== "preview") return;
    editorCanvasRef.current?.scrollTo({ top: 0, behavior: "auto" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  }, [canvasMode, editorCanvasRef]);

  /** Ny detail-side / annen node: struktur som utgangspunkt (ikke bland med Bellissima workspace-view). */
  useEffect(() => {
    if (detailRouteEntityId) setDetailEditorMode("structure");
  }, [detailRouteEntityId]);

  return {
    detailEditorMode,
    setDetailEditorMode,
    selectedBlockId,
    setSelectedBlockId,
    hoverBlockId,
    setHoverBlockId,
    showPreviewColumn,
    setShowPreviewColumn,
    previewLayoutMode,
    setPreviewLayoutMode,
    canvasMode,
    setCanvasMode,
    previewDevice,
    setPreviewDevice,
    inspectorSection: activeInspectorSection,
    setInspectorSection,
    showBlocks,
    showPreview,
    selectedBlock,
    selectedBlockForInspector,
    selectedBlockIndex,
    onSelectBlockFromTree,
    onDeleteBlock,
  };
}
