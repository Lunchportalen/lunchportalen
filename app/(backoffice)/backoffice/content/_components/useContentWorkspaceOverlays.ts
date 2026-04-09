"use client";

/**
 * Overlay / subview UI state only: global tabs, block picker, invalid-body confirm,
 * editor CMS menu draft, editor_opened telemetry. AI transport lives in
 * `useContentWorkspaceAi.ts`, `useContentWorkspacePanelAi` (kompositor: copilot / design / growth–autonomy / page-draft),
 * `useContentWorkspaceRichTextAi.ts`, og stateless HTTP i `contentWorkspace.aiRequests.ts`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { logEditorAiEvent } from "@/domain/backoffice/ai/metrics/logEditorAiEvent";
import type { EditorAiMenuValue } from "./EditorAiPanel";
import { type BodyMode } from "./contentWorkspace.blocks";

export type UseContentWorkspaceOverlayUiParams = {
  effectiveId: string | null;
  selectedId: string;
  bodyMode: BodyMode;
};

export function useContentWorkspaceOverlays(p: UseContentWorkspaceOverlayUiParams) {
  const { effectiveId, selectedId, bodyMode } = p;

  const [contentSettingsTab, setContentSettingsTab] = useState<
    "general" | "analytics" | "form" | "shop" | "globalContent" | "notification" | "scripts" | "advanced"
  >("general");
  const [navigationTab, setNavigationTab] = useState<
    "main" | "secondary" | "footer" | "member" | "cta" | "language" | "advanced"
  >("main");
  const [footerTab, setFooterTab] = useState<"content" | "advanced">("content");
  const [designTab, setDesignTab] = useState<
    "Layout" | "Logo" | "Colors" | "Spacing" | "Fonts" | "Backgrounds" | "CSS" | "JavaScript" | "Advanced"
  >("Layout");

  const [editorCmsMenuDraft, setEditorCmsMenuDraft] = useState<EditorAiMenuValue>({
    title: "",
    description: "",
    allergens: [],
    images: [],
  });

  const [invalidBodyResetConfirmOpen, setInvalidBodyResetConfirmOpen] = useState(false);
  const editorOpenedLoggedForRef = useRef<string | null>(null);
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);
  const addInsertIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!effectiveId) {
      editorOpenedLoggedForRef.current = null;
      return;
    }
    if (editorOpenedLoggedForRef.current === effectiveId) return;
    editorOpenedLoggedForRef.current = effectiveId;
    logEditorAiEvent({
      type: "editor_opened",
      pageId: effectiveId,
      variantId: null,
      timestamp: new Date().toISOString(),
    });
  }, [effectiveId]);

  const requestInvalidBodyResetConfirm = useCallback(() => {
    setInvalidBodyResetConfirmOpen(true);
  }, []);

  const closeInvalidBodyResetConfirm = useCallback(() => setInvalidBodyResetConfirmOpen(false), []);

  useEffect(() => {
    if (bodyMode !== "invalid") setInvalidBodyResetConfirmOpen(false);
  }, [bodyMode]);

  useEffect(() => {
    setInvalidBodyResetConfirmOpen(false);
    setBlockPickerOpen(false);
    addInsertIndexRef.current = null;
  }, [effectiveId]);

  return {
    contentSettingsTab,
    setContentSettingsTab,
    navigationTab,
    setNavigationTab,
    footerTab,
    setFooterTab,
    designTab,
    setDesignTab,
    editorCmsMenuDraft,
    setEditorCmsMenuDraft,
    invalidBodyResetConfirmOpen,
    requestInvalidBodyResetConfirm,
    closeInvalidBodyResetConfirm,
    blockPickerOpen,
    setBlockPickerOpen,
    addInsertIndexRef,
  };
}
