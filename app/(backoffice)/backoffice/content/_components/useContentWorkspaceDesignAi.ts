"use client";

/**
 * Design-AI: analyse/generering, preview, apply/discard, egne busy/error.
 * Transport: `contentWorkspace.aiRequests.ts`.
 */

import { useCallback, useEffect, useState } from "react";
import { logEditorAiEvent } from "@/domain/backoffice/ai/metrics/logEditorAiEvent";
import type { DesignIssueRow } from "./EditorDesignAiPanel";
import type { Block } from "./editorBlockTypes";
import { normalizeBlocks } from "./contentWorkspace.blocks";
import { fetchPublicAiPostJson } from "./contentWorkspace.aiRequests";
import type { UseContentWorkspacePanelRequestsParams } from "./contentWorkspace.panelAi.types";

export type UseContentWorkspaceDesignAiParams = Pick<
  UseContentWorkspacePanelRequestsParams,
  | "effectiveId"
  | "showBlocks"
  | "isContentTab"
  | "cmsEditorRole"
  | "displayBlocks"
  | "setBlocks"
  | "isWow"
  | "showAfter"
  | "originalBlocks"
  | "setOriginalBlocks"
>;

export function useContentWorkspaceDesignAi(p: UseContentWorkspaceDesignAiParams) {
  const {
    effectiveId,
    showBlocks,
    isContentTab,
    cmsEditorRole,
    displayBlocks,
    setBlocks,
    isWow,
    showAfter,
    originalBlocks,
    setOriginalBlocks,
  } = p;

  const [designScore, setDesignScore] = useState<number | null>(null);
  const [designIssues, setDesignIssues] = useState<DesignIssueRow[]>([]);
  const [designSuggestions, setDesignSuggestions] = useState<string[]>([]);
  const [designPreviewBlocks, setDesignPreviewBlocks] = useState<Block[] | null>(null);
  const [designPreviewSuggestionLines, setDesignPreviewSuggestionLines] = useState<string[]>([]);
  const [designPanelBusy, setDesignPanelBusy] = useState(false);
  const [designPanelError, setDesignPanelError] = useState<string | null>(null);

  const designPanelEnabled = Boolean(showBlocks && isContentTab && effectiveId);
  const controlTowerEnabled = designPanelEnabled && cmsEditorRole === "superadmin";

  const onDesignAnalyze = useCallback(async () => {
    if (!designPanelEnabled) return;
    setDesignPanelBusy(true);
    setDesignPanelError(null);
    try {
      const { ok: httpOk, json } = await fetchPublicAiPostJson("/api/ai/design/analyze", {
        blocks: displayBlocks,
      });
      const body = json as {
        ok?: boolean;
        data?: { score?: number; issues?: DesignIssueRow[]; suggestions?: string[] };
        error?: string;
      };
      if (!httpOk || body.ok === false) {
        setDesignPanelError(typeof body.error === "string" ? body.error : "Designanalyse feilet");
        return;
      }
      setDesignScore(typeof body.data?.score === "number" ? body.data.score : null);
      setDesignIssues(Array.isArray(body.data?.issues) ? body.data!.issues! : []);
      setDesignSuggestions(Array.isArray(body.data?.suggestions) ? body.data!.suggestions! : []);
    } catch {
      setDesignPanelError("Nettverksfeil ved designanalyse");
    } finally {
      setDesignPanelBusy(false);
    }
  }, [designPanelEnabled, displayBlocks]);

  const onDesignImprove = useCallback(async () => {
    if (!designPanelEnabled) return;
    setDesignPanelBusy(true);
    setDesignPanelError(null);
    try {
      const { ok: httpOk, json } = await fetchPublicAiPostJson("/api/ai/design/generate", {
        blocks: displayBlocks,
      });
      const body = json as {
        ok?: boolean;
        data?: { updatedBlocks?: unknown[]; suggestions?: string[] };
        error?: string;
      };
      if (!httpOk || body.ok === false) {
        setDesignPanelError(typeof body.error === "string" ? body.error : "Designgenerering feilet");
        return;
      }
      const raw = Array.isArray(body.data?.updatedBlocks) ? body.data!.updatedBlocks! : [];
      const normalized = normalizeBlocks(raw);
      if (normalized.length === 0 && raw.length > 0) {
        setDesignPanelError("Forhåndsvisning mangler gyldige blokker.");
        setDesignPreviewBlocks(null);
        setDesignPreviewSuggestionLines([]);
        return;
      }
      setDesignPreviewBlocks(normalized);
      setDesignPreviewSuggestionLines(
        Array.isArray(body.data?.suggestions) ? body.data!.suggestions!.map((s) => String(s)) : [],
      );
    } catch {
      setDesignPanelError("Nettverksfeil ved designgenerering");
    } finally {
      setDesignPanelBusy(false);
    }
  }, [designPanelEnabled, displayBlocks]);

  const onDesignApplyPreview = useCallback(() => {
    if (!designPreviewBlocks || designPreviewBlocks.length === 0) return;
    logEditorAiEvent({
      type: "ai_patch_applied",
      feature: "layout_suggestions",
      pageId: effectiveId ?? null,
      variantId: null,
      timestamp: new Date().toISOString(),
    });
    if (isWow && !showAfter && Array.isArray(originalBlocks)) {
      setOriginalBlocks(designPreviewBlocks);
    } else {
      setBlocks(designPreviewBlocks);
    }
    setDesignPreviewBlocks(null);
    setDesignPreviewSuggestionLines([]);
  }, [
    designPreviewBlocks,
    effectiveId,
    isWow,
    showAfter,
    originalBlocks,
    setBlocks,
    setOriginalBlocks,
  ]);

  const onDesignDiscardPreview = useCallback(() => {
    setDesignPreviewBlocks(null);
    setDesignPreviewSuggestionLines([]);
  }, []);

  useEffect(() => {
    setDesignScore(null);
    setDesignIssues([]);
    setDesignSuggestions([]);
    setDesignPreviewBlocks(null);
    setDesignPreviewSuggestionLines([]);
    setDesignPanelBusy(false);
    setDesignPanelError(null);
  }, [effectiveId]);

  return {
    designScore,
    designIssues,
    designSuggestions,
    designPreviewBlocks,
    designPreviewSuggestionLines,
    designPanelBusy,
    designPanelError,
    designPanelEnabled,
    controlTowerEnabled,
    onDesignAnalyze,
    onDesignImprove,
    onDesignApplyPreview,
    onDesignDiscardPreview,
  };
}
