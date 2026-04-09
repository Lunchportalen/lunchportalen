"use client";

/**
 * Høyre rail: AI-fanen, Diagnose-fanen, AI CEO-fanen — ren komposisjon av eksisterende paneler.
 * Ingen nye hooks eller transport; skallet sender ferdige callbacks og state.
 */

import type { ReactNode } from "react";
import { ContentAiTools } from "./ContentAiTools";
import type { EditorAiMenuValue } from "./EditorAiPanel";
import { getBlockTreeLabel } from "./blockLabels";
import type { Block } from "./editorBlockTypes";
import type { ContentPage } from "./ContentWorkspaceState";
import type { AiCapabilityStatus } from "./useContentWorkspaceAi";

export type ContentWorkspaceRightRailSlotsProps = {
  shell: {
    isPitch: boolean;
    isOffline: boolean;
    effectiveId: string | null;
    page: ContentPage | null;
    showBlocks: boolean;
    title: string;
    blocks: Block[];
    meta: Record<string, unknown>;
  };
  blockNav: {
    selectedBlockForInspector: Block | null;
    selectedBlockIndex: number;
  };
  cmsAi: {
    cmsAiMultimodalPrompt: string;
    setCmsAiMultimodalPrompt: (v: string) => void;
    cmsAiLayoutBusy: boolean;
    cmsAiPageBusy: boolean;
    aiFullPageBusy: boolean;
    aiAbExperimentBusy: boolean;
    aiCapability: AiCapabilityStatus;
    onCmsAiGenerateLayout: (prompt: string) => void | Promise<void>;
    onCmsAiGeneratePageDraft: (prompt: string) => void | Promise<void>;
    onStartAiAbExperiment: () => void | Promise<void>;
    aiAbExperimentNote: string | null;
    setAiFullPageModalPrompt: (v: string) => void;
    setAiFullPagePreview: (v: { title: string; blocksRaw: unknown[] } | null) => void;
    setAiFullPageError: (v: string | null) => void;
    setAiFullPageReplaceOk: (v: boolean) => void;
    setAiFullPageAlsoTitle: (v: boolean) => void;
    setAiFullPageModalOpen: (v: boolean) => void;
  };
  pageIntent: {
    aiPageBuilderBusy: boolean;
    aiPageIntentPrompt: string;
    setAiPageIntentPrompt: (v: string) => void;
    aiPageIntentReplace: boolean;
    setAiPageIntentReplace: (v: boolean) => void;
    aiPageIntentEnrichLayout: boolean;
    setAiPageIntentEnrichLayout: (v: boolean) => void;
    aiPageIntentExplanation: string | null;
    onAiPageIntentGenerate: () => void | Promise<void>;
    aiSectionInsertPrompt: string;
    setAiSectionInsertPrompt: (v: string) => void;
    onAiSectionInsertAtSelection: () => void | Promise<void>;
  };
  editorCmsMenu: {
    editorCmsMenuDraft: EditorAiMenuValue;
    setEditorCmsMenuDraft: React.Dispatch<React.SetStateAction<EditorAiMenuValue>>;
  };
  panelAi: {
    growthPanelEnabled: boolean;
    growthProductInput: string;
    growthAudienceInput: string;
    setGrowthProductInput: (v: string) => void;
    setGrowthAudienceInput: (v: string) => void;
    growthBusy: boolean;
    growthError: string | null;
    growthSeoOpportunities: import("./EditorGrowthAiPanel").GrowthSeoOpportunity[];
    growthSeoKeywords: import("./EditorGrowthAiPanel").GrowthSeoKeyword[];
    growthContentIdeas: string[];
    growthAdHeadlines: string[];
    growthAdDescriptions: string[];
    growthFunnelSteps: import("./EditorGrowthAiPanel").GrowthFunnelStep[];
    growthFunnelImprovements: string[];
    onGrowthRunSeo: () => void | Promise<void>;
    onGrowthRunAds: () => void | Promise<void>;
    onGrowthRunFunnel: () => void | Promise<void>;
    onGrowthClearPreview: () => void;
    autonomyPanelEnabled: boolean;
    autonomyBusy: boolean;
    autonomyError: string | null;
    autonomyMetrics: import("./EditorAutonomyPanel").DashboardMetricsPayload | null;
    autonomyInsights: import("./EditorAutonomyPanel").DashboardInsightsPayload | null;
    autonomyDecisionRow: import("./EditorAutonomyPanel").DashboardDecisionPayload | null;
    autonomyAutomationText: string | null;
    onAutonomyRefreshDashboard: () => void | Promise<void>;
    onAutonomyPreviewAutomation: (d: import("@/lib/ai/decisionEngine").DecisionResult) => void | Promise<void>;
    onAutonomyApproveExecute: (d: import("@/lib/ai/decisionEngine").DecisionResult) => void | Promise<void>;
    visibleCopilotSuggestions: import("./EditorCopilotRail").CopilotSuggestion[];
    copilotBusy: boolean;
    copilotError: string | null;
    onCopilotApply: (s: import("./EditorCopilotRail").CopilotSuggestion) => void;
    onCopilotDismiss: (id: string) => void;
  };
  workspaceAi: {
    aiCapability: AiCapabilityStatus;
    aiBusyToolId: string | null;
    aiError: string | null;
    aiSummary: string | null;
    aiBlockBuilderResult: {
      block: Record<string, unknown>;
      message: string;
      pageId?: string | null;
    } | null;
    aiLastAppliedTool: string | null;
    aiScreenshotBuilderResult: {
      message?: string;
      blocks: unknown[];
      blockTypes?: string[];
      warnings?: string[];
    } | null;
    lastGeneratedImageResult: import("./editorAiContracts").ImageGeneratorResult | null;
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
    } | null;
    diagnosticsResult: {
      improvePage: { summary: string; applied: boolean };
      seo: { summary: string; applied: boolean };
    } | null;
    diagnosticsBusy: boolean;
    aiHistory: Array<{ id: string; tool: string; label: string; detail?: string; at: string }>;
    onClearError: () => void;
    onRunDiagnostics: () => Promise<void>;
    handleAiImprovePage: (input: { goal: "lead" | "info" | "signup"; audience: string }) => void;
    handleAiSeoOptimize: (
      input: { goal: "lead" | "info" | "signup"; audience: string },
      opts?: { fromInline?: boolean }
    ) => void;
    handleAiGenerateSections: (input: { goal: string; audience: string }) => void;
    handleAiStructuredIntent: (
      input: { variantCount: 2 | 3; target: "hero_cta" | "hero_only" },
      opts?: { fromPanel?: boolean }
    ) => void;
    handleLayoutSuggestions: () => void;
    handleApplyDesignSuggestion: (suggestion: {
      kind: string;
      title: string;
      reason: string;
      priority: string;
      previewLabel?: string;
      applyPatch?: unknown;
    }) => void;
    handleDismissDesignSuggestion: (suggestion: { kind: string; title: string }) => void;
    handleBlockBuilder: (input: { description: string }) => void;
    onBlockBuilderInsert: () => void;
    handleAiImageGenerate: (input: { purpose: "hero" | "section" | "social"; topic: string }) => void;
    handleScreenshotBuilder: (input: { screenshotUrl?: string; description?: string }) => void;
    onScreenshotBuilderReplace: () => void;
    onScreenshotBuilderAppend: () => void;
    handleAiImageImproveMetadata: (input: { mediaItemId: string; url: string }) => void;
  };
  diagnose: {
    designPanelEnabled: boolean;
    controlTowerEnabled: boolean;
    designScore: number | null;
    designIssues: import("./EditorDesignAiPanel").DesignIssueRow[];
    designSuggestions: string[];
    designPreviewSuggestionLines: string[];
    designPreviewBlocks: Block[] | null;
    designPanelBusy: boolean;
    designPanelError: string | null;
    onDesignAnalyze: () => void | Promise<void>;
    onDesignImprove: () => void | Promise<void>;
    onDesignApplyPreview: () => void;
    onDesignDiscardPreview: () => void;
    setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
    aiAudit: { score: number; issues: string[] } | null;
  };
};

export function buildContentWorkspaceRightRailSlots(
  p: ContentWorkspaceRightRailSlotsProps
): { aiSlot: ReactNode; diagnoseSlot: ReactNode; ceoSlot: ReactNode } {
  const { shell, blockNav, workspaceAi } = p;
  const { isPitch, isOffline, effectiveId } = shell;
  const { selectedBlockForInspector, selectedBlockIndex } = blockNav;

  const aiSlot = (
    <div className="space-y-4" role="region" aria-label="AI-assistent" data-lp-editor-ai-region>
      <div className="rounded-xl border border-pink-500/15 bg-white/70 px-3 py-2.5 shadow-[var(--lp-shadow-soft)] backdrop-blur-md">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">AI i editoren</p>
        <p className="mt-1 text-xs leading-snug text-[rgb(var(--lp-muted))]">
          Kun den kanoniske forbedringsflyten er synlig her. Parallelle eller ubeviste AI-flater er skjult til de er
          ende-til-ende verifisert i samme workspace-sannhet.
        </p>
      </div>
      {isPitch ? null : (
        <ContentAiTools
          contextLabel={
            selectedBlockForInspector
              ? `${selectedBlockIndex >= 0 ? `${selectedBlockIndex + 1}. ` : ""}${getBlockTreeLabel(selectedBlockForInspector)}`
              : null
          }
          focusedBlockType={selectedBlockForInspector?.type ?? null}
          focusedBlockLabel={selectedBlockForInspector ? getBlockTreeLabel(selectedBlockForInspector) : null}
          disabled={isOffline || !effectiveId || workspaceAi.aiCapability !== "available"}
          aiCapabilityStatus={workspaceAi.aiCapability}
          busyToolId={workspaceAi.aiBusyToolId}
          errorMessage={workspaceAi.aiError}
          lastSummary={workspaceAi.aiSummary}
          lastAppliedTool={workspaceAi.aiLastAppliedTool}
          onImprovePage={workspaceAi.handleAiImprovePage}
          onSeoOptimize={workspaceAi.handleAiSeoOptimize}
          onRunDiagnostics={workspaceAi.onRunDiagnostics}
          diagnosticsResult={workspaceAi.diagnosticsResult}
          diagnosticsBusy={workspaceAi.diagnosticsBusy}
          aiHistory={workspaceAi.aiHistory}
          onClearError={workspaceAi.onClearError}
        />
      )}
    </div>
  );

  const diagnoseSlot = (
    <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
      <p className="text-sm font-semibold text-[rgb(var(--lp-text))]">Utvidede AI-flater er skjult</p>
      <p className="mt-1 text-xs leading-relaxed text-[rgb(var(--lp-muted))]">
        Diagnose-, design- og ledelsesflater vises ikke i editoren før de er bevist ende-til-ende mot samme auth-,
        runtime- og workspace-sannhet som den kanoniske AI-flyten.
      </p>
    </div>
  );

  const ceoSlot = null;

  return { aiSlot, diagnoseSlot, ceoSlot };
}
