/**
 * Høyre-rail slot-bygging: ren pass-through til `buildContentWorkspaceRightRailSlots`.
 * Hook + flat view-model — ingen ny forretningslogikk.
 */

"use client";

import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DecisionResult } from "@/lib/ai/decisionEngine";
import { buildContentWorkspaceRightRailSlots } from "./ContentWorkspaceRightRail";
import type { ContentWorkspaceRightRailSlotsProps } from "./ContentWorkspaceRightRail";
import type { ContentPage } from "./ContentWorkspaceState";
import type { CopilotSuggestion } from "./EditorCopilotRail";
import type { EditorAiMenuValue } from "./EditorAiPanel";
import type { DashboardDecisionPayload, DashboardInsightsPayload, DashboardMetricsPayload } from "./EditorAutonomyPanel";
import type { DesignIssueRow } from "./EditorDesignAiPanel";
import type { GrowthFunnelStep, GrowthSeoKeyword, GrowthSeoOpportunity } from "./EditorGrowthAiPanel";
import type { Block } from "./editorBlockTypes";
import type { AiCapabilityStatus } from "./useContentWorkspaceAi";
import type { RightRailSlotsWorkspaceParams } from "./contentWorkspaceRightRailViewModel";

export function buildRightRailShellInput(
  isPitch: boolean,
  isOffline: boolean,
  effectiveId: string | null,
  page: ContentPage | null,
  showBlocks: boolean,
  title: string,
  blocks: Block[],
  meta: Record<string, unknown>,
): ContentWorkspaceRightRailSlotsProps["shell"] {
  return { isPitch, isOffline, effectiveId, page, showBlocks, title, blocks, meta };
}

export function buildRightRailBlockNavInput(
  selectedBlockForInspector: Block | null,
  selectedBlockIndex: number,
): ContentWorkspaceRightRailSlotsProps["blockNav"] {
  return { selectedBlockForInspector, selectedBlockIndex };
}

export function buildRightRailCmsAiInput(
  cmsAiMultimodalPrompt: string,
  setCmsAiMultimodalPrompt: (v: string) => void,
  cmsAiLayoutBusy: boolean,
  cmsAiPageBusy: boolean,
  aiFullPageBusy: boolean,
  aiAbExperimentBusy: boolean,
  aiCapability: AiCapabilityStatus,
  onCmsAiGenerateLayout: (prompt: string) => void | Promise<void>,
  onCmsAiGeneratePageDraft: (prompt: string) => void | Promise<void>,
  onStartAiAbExperiment: () => void | Promise<void>,
  aiAbExperimentNote: string | null,
  setAiFullPageModalPrompt: (v: string) => void,
  setAiFullPagePreview: (v: { title: string; blocksRaw: unknown[] } | null) => void,
  setAiFullPageError: (v: string | null) => void,
  setAiFullPageReplaceOk: (v: boolean) => void,
  setAiFullPageAlsoTitle: (v: boolean) => void,
  setAiFullPageModalOpen: (v: boolean) => void,
): ContentWorkspaceRightRailSlotsProps["cmsAi"] {
  return {
    cmsAiMultimodalPrompt,
    setCmsAiMultimodalPrompt,
    cmsAiLayoutBusy,
    cmsAiPageBusy,
    aiFullPageBusy,
    aiAbExperimentBusy,
    aiCapability,
    onCmsAiGenerateLayout,
    onCmsAiGeneratePageDraft,
    onStartAiAbExperiment,
    aiAbExperimentNote,
    setAiFullPageModalPrompt,
    setAiFullPagePreview,
    setAiFullPageError,
    setAiFullPageReplaceOk,
    setAiFullPageAlsoTitle,
    setAiFullPageModalOpen,
  };
}

export function buildRightRailPageIntentInput(
  aiPageBuilderBusy: boolean,
  aiPageIntentPrompt: string,
  setAiPageIntentPrompt: (v: string) => void,
  aiPageIntentReplace: boolean,
  setAiPageIntentReplace: (v: boolean) => void,
  aiPageIntentEnrichLayout: boolean,
  setAiPageIntentEnrichLayout: (v: boolean) => void,
  aiPageIntentExplanation: string | null,
  onAiPageIntentGenerate: () => void | Promise<void>,
  aiSectionInsertPrompt: string,
  setAiSectionInsertPrompt: (v: string) => void,
  onAiSectionInsertAtSelection: () => void | Promise<void>,
): ContentWorkspaceRightRailSlotsProps["pageIntent"] {
  return {
    aiPageBuilderBusy,
    aiPageIntentPrompt,
    setAiPageIntentPrompt,
    aiPageIntentReplace,
    setAiPageIntentReplace,
    aiPageIntentEnrichLayout,
    setAiPageIntentEnrichLayout,
    aiPageIntentExplanation,
    onAiPageIntentGenerate,
    aiSectionInsertPrompt,
    setAiSectionInsertPrompt,
    onAiSectionInsertAtSelection,
  };
}

export function buildRightRailEditorCmsMenuInput(
  editorCmsMenuDraft: EditorAiMenuValue,
  setEditorCmsMenuDraft: Dispatch<SetStateAction<EditorAiMenuValue>>,
): ContentWorkspaceRightRailSlotsProps["editorCmsMenu"] {
  return { editorCmsMenuDraft, setEditorCmsMenuDraft };
}

export function buildRightRailPanelAiInput(
  growthPanelEnabled: boolean,
  growthProductInput: string,
  growthAudienceInput: string,
  setGrowthProductInput: (v: string) => void,
  setGrowthAudienceInput: (v: string) => void,
  growthBusy: boolean,
  growthError: string | null,
  growthSeoOpportunities: GrowthSeoOpportunity[],
  growthSeoKeywords: GrowthSeoKeyword[],
  growthContentIdeas: string[],
  growthAdHeadlines: string[],
  growthAdDescriptions: string[],
  growthFunnelSteps: GrowthFunnelStep[],
  growthFunnelImprovements: string[],
  onGrowthRunSeo: () => void | Promise<void>,
  onGrowthRunAds: () => void | Promise<void>,
  onGrowthRunFunnel: () => void | Promise<void>,
  onGrowthClearPreview: () => void,
  autonomyPanelEnabled: boolean,
  autonomyBusy: boolean,
  autonomyError: string | null,
  autonomyMetrics: DashboardMetricsPayload | null,
  autonomyInsights: DashboardInsightsPayload | null,
  autonomyDecisionRow: DashboardDecisionPayload | null,
  autonomyAutomationText: string | null,
  onAutonomyRefreshDashboard: () => void | Promise<void>,
  onAutonomyPreviewAutomation: (d: DecisionResult) => void | Promise<void>,
  onAutonomyApproveExecute: (d: DecisionResult) => void | Promise<void>,
  visibleCopilotSuggestions: CopilotSuggestion[],
  copilotBusy: boolean,
  copilotError: string | null,
  onCopilotApply: (s: CopilotSuggestion) => void,
  onCopilotDismiss: (id: string) => void,
): ContentWorkspaceRightRailSlotsProps["panelAi"] {
  return {
    growthPanelEnabled,
    growthProductInput,
    growthAudienceInput,
    setGrowthProductInput,
    setGrowthAudienceInput,
    growthBusy,
    growthError,
    growthSeoOpportunities,
    growthSeoKeywords,
    growthContentIdeas,
    growthAdHeadlines,
    growthAdDescriptions,
    growthFunnelSteps,
    growthFunnelImprovements,
    onGrowthRunSeo,
    onGrowthRunAds,
    onGrowthRunFunnel,
    onGrowthClearPreview,
    autonomyPanelEnabled,
    autonomyBusy,
    autonomyError,
    autonomyMetrics,
    autonomyInsights,
    autonomyDecisionRow,
    autonomyAutomationText,
    onAutonomyRefreshDashboard,
    onAutonomyPreviewAutomation,
    onAutonomyApproveExecute,
    visibleCopilotSuggestions,
    copilotBusy,
    copilotError,
    onCopilotApply,
    onCopilotDismiss,
  };
}

export function buildRightRailWorkspaceAiInput(
  aiCapability: AiCapabilityStatus,
  aiBusyToolId: string | null,
  aiError: string | null,
  aiSummary: string | null,
  aiBlockBuilderResult: {
    block: Record<string, unknown>;
    message: string;
    pageId?: string | null;
  } | null,
  aiLastAppliedTool: string | null,
  aiScreenshotBuilderResult: {
    message?: string;
    blocks: unknown[];
    blockTypes?: string[];
    warnings?: string[];
  } | null,
  lastGeneratedImageResult: import("./editorAiContracts").ImageGeneratorResult | null,
  lastLayoutSuggestionsResult: {
    suggestions: Array<{
      kind: string;
      title: string;
      reason: string;
      priority: string;
      previewLabel?: string;
      applyPatch?: unknown;
    }>;
    message: string;
  } | null,
  diagnosticsResult: {
    improvePage: { summary: string; applied: boolean };
    seo: { summary: string; applied: boolean };
  } | null,
  diagnosticsBusy: boolean,
  aiHistory: Array<{ id: string; tool: string; label: string; detail?: string; at: string }>,
  onClearError: () => void,
  onRunDiagnostics: () => Promise<void>,
  handleAiImprovePage: (input: { goal: "lead" | "info" | "signup"; audience: string }) => void,
  handleAiSeoOptimize: (
    input: { goal: "lead" | "info" | "signup"; audience: string },
    opts?: { fromInline?: boolean },
  ) => void,
  handleAiGenerateSections: (input: { goal: string; audience: string }) => void,
  handleAiStructuredIntent: (
    input: { variantCount: 2 | 3; target: "hero_cta" | "hero_only" },
    opts?: { fromPanel?: boolean },
  ) => void,
  handleLayoutSuggestions: () => void,
  handleApplyDesignSuggestion: (suggestion: {
    kind: string;
    title: string;
    reason: string;
    priority: string;
    previewLabel?: string;
    applyPatch?: unknown;
  }) => void,
  handleDismissDesignSuggestion: (suggestion: { kind: string; title: string }) => void,
  handleBlockBuilder: (input: { description: string }) => void,
  onBlockBuilderInsert: () => void,
  handleAiImageGenerate: (input: { purpose: "hero" | "section" | "social"; topic: string }) => void,
  handleScreenshotBuilder: (input: { screenshotUrl?: string; description?: string }) => void,
  onScreenshotBuilderReplace: () => void,
  onScreenshotBuilderAppend: () => void,
  handleAiImageImproveMetadata: (input: { mediaItemId: string; url: string }) => void,
): ContentWorkspaceRightRailSlotsProps["workspaceAi"] {
  return {
    aiCapability,
    aiBusyToolId,
    aiError,
    aiSummary,
    aiBlockBuilderResult,
    aiLastAppliedTool,
    aiScreenshotBuilderResult,
    lastGeneratedImageResult,
    lastLayoutSuggestionsResult,
    diagnosticsResult,
    diagnosticsBusy,
    aiHistory,
    onClearError,
    onRunDiagnostics,
    handleAiImprovePage,
    handleAiSeoOptimize,
    handleAiGenerateSections,
    handleAiStructuredIntent,
    handleLayoutSuggestions,
    handleApplyDesignSuggestion,
    handleDismissDesignSuggestion,
    handleBlockBuilder,
    onBlockBuilderInsert,
    handleAiImageGenerate,
    handleScreenshotBuilder,
    onScreenshotBuilderReplace,
    onScreenshotBuilderAppend,
    handleAiImageImproveMetadata,
  };
}

export function buildRightRailDiagnoseInput(
  designPanelEnabled: boolean,
  controlTowerEnabled: boolean,
  designScore: number | null,
  designIssues: DesignIssueRow[],
  designSuggestions: string[],
  designPreviewSuggestionLines: string[],
  designPreviewBlocks: Block[] | null,
  designPanelBusy: boolean,
  designPanelError: string | null,
  onDesignAnalyze: () => void | Promise<void>,
  onDesignImprove: () => void | Promise<void>,
  onDesignApplyPreview: () => void,
  onDesignDiscardPreview: () => void,
  setBlocks: Dispatch<SetStateAction<Block[]>>,
  aiAudit: { score: number; issues: string[] } | null,
): ContentWorkspaceRightRailSlotsProps["diagnose"] {
  return {
    designPanelEnabled,
    controlTowerEnabled,
    designScore,
    designIssues,
    designSuggestions,
    designPreviewSuggestionLines,
    designPreviewBlocks,
    designPanelBusy,
    designPanelError,
    onDesignAnalyze,
    onDesignImprove,
    onDesignApplyPreview,
    onDesignDiscardPreview,
    setBlocks,
    aiAudit,
  };
}

export function buildRightRailSlotsFromWorkspaceArgs(p: RightRailSlotsWorkspaceParams) {
  return buildContentWorkspaceRightRailSlots({
    shell: buildRightRailShellInput(p.isPitch, p.isOffline, p.effectiveId, p.page, p.showBlocks, p.title, p.blocks, p.meta),
    blockNav: buildRightRailBlockNavInput(p.selectedBlockForInspector, p.selectedBlockIndex),
    cmsAi: buildRightRailCmsAiInput(
      p.cmsAiMultimodalPrompt,
      p.setCmsAiMultimodalPrompt,
      p.cmsAiLayoutBusy,
      p.cmsAiPageBusy,
      p.aiFullPageBusy,
      p.aiAbExperimentBusy,
      p.aiCapability,
      p.onCmsAiGenerateLayout,
      p.onCmsAiGeneratePageDraft,
      p.onStartAiAbExperiment,
      p.aiAbExperimentNote,
      p.setAiFullPageModalPrompt,
      p.setAiFullPagePreview,
      p.setAiFullPageError,
      p.setAiFullPageReplaceOk,
      p.setAiFullPageAlsoTitle,
      p.setAiFullPageModalOpen,
    ),
    pageIntent: buildRightRailPageIntentInput(
      p.aiPageBuilderBusy,
      p.aiPageIntentPrompt,
      p.setAiPageIntentPrompt,
      p.aiPageIntentReplace,
      p.setAiPageIntentReplace,
      p.aiPageIntentEnrichLayout,
      p.setAiPageIntentEnrichLayout,
      p.aiPageIntentExplanation,
      p.onAiPageIntentGenerate,
      p.aiSectionInsertPrompt,
      p.setAiSectionInsertPrompt,
      p.onAiSectionInsertAtSelection,
    ),
    editorCmsMenu: buildRightRailEditorCmsMenuInput(p.editorCmsMenuDraft, p.setEditorCmsMenuDraft),
    panelAi: buildRightRailPanelAiInput(
      p.growthPanelEnabled,
      p.growthProductInput,
      p.growthAudienceInput,
      p.setGrowthProductInput,
      p.setGrowthAudienceInput,
      p.growthBusy,
      p.growthError,
      p.growthSeoOpportunities,
      p.growthSeoKeywords,
      p.growthContentIdeas,
      p.growthAdHeadlines,
      p.growthAdDescriptions,
      p.growthFunnelSteps,
      p.growthFunnelImprovements,
      p.onGrowthRunSeo,
      p.onGrowthRunAds,
      p.onGrowthRunFunnel,
      p.onGrowthClearPreview,
      p.autonomyPanelEnabled,
      p.autonomyBusy,
      p.autonomyError,
      p.autonomyMetrics,
      p.autonomyInsights,
      p.autonomyDecisionRow,
      p.autonomyAutomationText,
      p.onAutonomyRefreshDashboard,
      p.onAutonomyPreviewAutomation,
      p.onAutonomyApproveExecute,
      p.visibleCopilotSuggestions,
      p.copilotBusy,
      p.copilotError,
      p.onCopilotApply,
      p.onCopilotDismiss,
    ),
    workspaceAi: buildRightRailWorkspaceAiInput(
      p.aiCapability,
      p.aiBusyToolId,
      p.aiError,
      p.aiSummary,
      p.aiBlockBuilderResult,
      p.aiLastAppliedTool,
      p.aiScreenshotBuilderResult,
      p.lastGeneratedImageResult,
      p.lastLayoutSuggestionsResult,
      p.diagnosticsResult,
      p.diagnosticsBusy,
      p.aiHistory,
      p.onClearError,
      p.onRunDiagnostics,
      p.handleAiImprovePage,
      p.handleAiSeoOptimize,
      p.handleAiGenerateSections,
      p.handleAiStructuredIntent,
      p.handleLayoutSuggestions,
      p.handleApplyDesignSuggestion,
      p.handleDismissDesignSuggestion,
      p.handleBlockBuilder,
      p.onBlockBuilderInsert,
      p.handleAiImageGenerate,
      p.handleScreenshotBuilder,
      p.onScreenshotBuilderReplace,
      p.onScreenshotBuilderAppend,
      p.handleAiImageImproveMetadata,
    ),
    diagnose: buildRightRailDiagnoseInput(
      p.designPanelEnabled,
      p.controlTowerEnabled,
      p.designScore,
      p.designIssues,
      p.designSuggestions,
      p.designPreviewSuggestionLines,
      p.designPreviewBlocks,
      p.designPanelBusy,
      p.designPanelError,
      p.onDesignAnalyze,
      p.onDesignImprove,
      p.onDesignApplyPreview,
      p.onDesignDiscardPreview,
      p.setBlocks,
      p.aiAudit,
    ),
  });
}

export function useContentWorkspaceRightRailSlots(p: RightRailSlotsWorkspaceParams) {
  /* eslint-disable react-hooks/exhaustive-deps -- explicit p.* deps match ContentWorkspace (FASE 21); parent passes a new object literal each render so `[p]` would bust memo */
  const slots = useMemo(
    () => buildRightRailSlotsFromWorkspaceArgs(p),
    [
      p.isPitch,
      p.isOffline,
      p.effectiveId,
      p.page,
      p.showBlocks,
      p.title,
      p.blocks,
      p.meta,
      p.selectedBlockForInspector,
      p.selectedBlockIndex,
      p.cmsAiMultimodalPrompt,
      p.setCmsAiMultimodalPrompt,
      p.cmsAiLayoutBusy,
      p.cmsAiPageBusy,
      p.aiFullPageBusy,
      p.aiAbExperimentBusy,
      p.aiCapability,
      p.onCmsAiGenerateLayout,
      p.onCmsAiGeneratePageDraft,
      p.onStartAiAbExperiment,
      p.aiAbExperimentNote,
      p.setAiFullPageModalPrompt,
      p.setAiFullPagePreview,
      p.setAiFullPageError,
      p.setAiFullPageReplaceOk,
      p.setAiFullPageAlsoTitle,
      p.setAiFullPageModalOpen,
      p.aiPageBuilderBusy,
      p.aiPageIntentPrompt,
      p.setAiPageIntentPrompt,
      p.aiPageIntentReplace,
      p.setAiPageIntentReplace,
      p.aiPageIntentEnrichLayout,
      p.setAiPageIntentEnrichLayout,
      p.aiPageIntentExplanation,
      p.onAiPageIntentGenerate,
      p.aiSectionInsertPrompt,
      p.setAiSectionInsertPrompt,
      p.onAiSectionInsertAtSelection,
      p.editorCmsMenuDraft,
      p.setEditorCmsMenuDraft,
      p.growthPanelEnabled,
      p.growthProductInput,
      p.growthAudienceInput,
      p.setGrowthProductInput,
      p.setGrowthAudienceInput,
      p.growthBusy,
      p.growthError,
      p.growthSeoOpportunities,
      p.growthSeoKeywords,
      p.growthContentIdeas,
      p.growthAdHeadlines,
      p.growthAdDescriptions,
      p.growthFunnelSteps,
      p.growthFunnelImprovements,
      p.onGrowthRunSeo,
      p.onGrowthRunAds,
      p.onGrowthRunFunnel,
      p.onGrowthClearPreview,
      p.autonomyPanelEnabled,
      p.autonomyBusy,
      p.autonomyError,
      p.autonomyMetrics,
      p.autonomyInsights,
      p.autonomyDecisionRow,
      p.autonomyAutomationText,
      p.onAutonomyRefreshDashboard,
      p.onAutonomyPreviewAutomation,
      p.onAutonomyApproveExecute,
      p.visibleCopilotSuggestions,
      p.copilotBusy,
      p.copilotError,
      p.onCopilotApply,
      p.onCopilotDismiss,
      p.aiBusyToolId,
      p.aiError,
      p.aiSummary,
      p.aiBlockBuilderResult,
      p.aiLastAppliedTool,
      p.aiScreenshotBuilderResult,
      p.lastGeneratedImageResult,
      p.lastLayoutSuggestionsResult,
      p.diagnosticsResult,
      p.diagnosticsBusy,
      p.aiHistory,
      p.onClearError,
      p.onRunDiagnostics,
      p.handleAiImprovePage,
      p.handleAiSeoOptimize,
      p.handleAiGenerateSections,
      p.handleAiStructuredIntent,
      p.handleLayoutSuggestions,
      p.handleApplyDesignSuggestion,
      p.handleDismissDesignSuggestion,
      p.handleBlockBuilder,
      p.onBlockBuilderInsert,
      p.handleAiImageGenerate,
      p.handleScreenshotBuilder,
      p.onScreenshotBuilderReplace,
      p.onScreenshotBuilderAppend,
      p.handleAiImageImproveMetadata,
      p.designPanelEnabled,
      p.controlTowerEnabled,
      p.designScore,
      p.designIssues,
      p.designSuggestions,
      p.designPreviewSuggestionLines,
      p.designPreviewBlocks,
      p.designPanelBusy,
      p.designPanelError,
      p.onDesignAnalyze,
      p.onDesignImprove,
      p.onDesignApplyPreview,
      p.onDesignDiscardPreview,
      p.setBlocks,
      p.aiAudit,
    ],
  );
  /* eslint-enable react-hooks/exhaustive-deps */
  return slots;
}
