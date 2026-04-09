"use client";

/**
 * Kompositor: copilot + design + growth/autonomy + full-page draft — én `useContentWorkspacePanelRequests`-API for `ContentWorkspace.tsx`.
 * Domene-logikk: `useContentWorkspaceCopilot`, `useContentWorkspaceDesignAi`, `useContentWorkspaceGrowthAutonomyAi`, `useContentWorkspacePageDraftAi`.
 */

import { useContentWorkspaceCopilot } from "./useContentWorkspaceCopilot";
import { useContentWorkspaceDesignAi } from "./useContentWorkspaceDesignAi";
import { useContentWorkspaceGrowthAutonomyAi } from "./useContentWorkspaceGrowthAutonomyAi";
import { useContentWorkspacePageDraftAi } from "./useContentWorkspacePageDraftAi";
import type { UseContentWorkspacePanelRequestsParams } from "./contentWorkspace.panelAi.types";

export type { UseContentWorkspacePanelRequestsParams } from "./contentWorkspace.panelAi.types";

export function useContentWorkspacePanelRequests(p: UseContentWorkspacePanelRequestsParams) {
  const copilot = useContentWorkspaceCopilot({
    effectiveId: p.effectiveId,
    showBlocks: p.showBlocks,
    isContentTab: p.isContentTab,
    selectedBlockId: p.selectedBlockId,
    setSelectedBlockId: p.setSelectedBlockId,
    title: p.title,
    displayBlocks: p.displayBlocks,
  });

  const design = useContentWorkspaceDesignAi({
    effectiveId: p.effectiveId,
    showBlocks: p.showBlocks,
    isContentTab: p.isContentTab,
    cmsEditorRole: p.cmsEditorRole,
    displayBlocks: p.displayBlocks,
    setBlocks: p.setBlocks,
    isWow: p.isWow,
    showAfter: p.showAfter,
    originalBlocks: p.originalBlocks,
    setOriginalBlocks: p.setOriginalBlocks,
  });

  const growthAutonomy = useContentWorkspaceGrowthAutonomyAi({
    effectiveId: p.effectiveId,
    showBlocks: p.showBlocks,
    isContentTab: p.isContentTab,
    displayBlocks: p.displayBlocks,
    page: p.page,
    title: p.title,
    slug: p.slug,
  });

  const pageDraft = useContentWorkspacePageDraftAi({
    effectiveId: p.effectiveId,
    blocks: p.blocks,
    page: p.page,
    slug: p.slug,
    title: p.title,
    setBlocks: p.setBlocks,
    setTitle: p.setTitle,
    setSaveStateSafe: p.setSaveStateSafe,
  });

  return {
    ...copilot,
    ...design,
    ...growthAutonomy,
    ...pageDraft,
  };
}
