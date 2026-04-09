"use client";

// STATUS: KEEP

import { ContentSaveBar, type ContentSaveBarProps } from "./ContentSaveBar";
import { ContentAiTools, type ContentAiToolsProps } from "./ContentAiTools";
import { ContentInfoPanel, type ContentInfoPanelPage } from "./ContentInfoPanel";
import { EditorAiAssistant, type EditorAiAssistantItem } from "./EditorAiAssistant";
import { EditorAiUnifiedSuggestions, type UnifiedAiSuggestion } from "./EditorAiUnifiedSuggestions";
import { AiQuickFixSuggestions } from "./AiQuickFixSuggestions";
import type { QuickFixSuggestion } from "./quickFixSuggestions";
import type { PageStatus } from "./contentTypes";

/** Unified AI: one score, one run, one suggestion list, one apply path. */
export type UnifiedAiProps = {
  seoScore?: number | null;
  croScore?: number | null;
  aiContentScore?: number | null;
  mediaHealthStatus?: "idle" | "checking" | "available" | "unavailable";
  contentHealthStatus?: "idle" | "checking" | "available" | "unavailable";
  aiCapabilityStatus?: "loading" | "available" | "unavailable";
  lastAnalyzedSummary?: string | null;
  suggestions: UnifiedAiSuggestion[];
  onRunAnalysis: () => void;
  runAnalysisBusy?: boolean;
  onApply: (id: string, source: "seo" | "cro") => void;
  onDismiss: (id: string, source: "seo" | "cro") => void;
  disabled?: boolean;
};

type ContentSidePanelProps = {
  shellV1: boolean;
  page: ContentInfoPanelPage | null;
  statusLabel: PageStatus;
  isForsidePage: () => boolean;
  formatDate: (value: string | null | undefined) => string;
  saveBarProps: ContentSaveBarProps;
  aiToolsProps: ContentAiToolsProps;
  /** Primary AI surface: score, run, suggestions, apply. When set, shown above AI-verktøy. */
  unifiedAi?: UnifiedAiProps | null;
  /** UI-only editor focus (page + section + selected block). */
  editorFocusLabel?: string | null;
  /** Optional AI assistant items (suggestions, warnings, improvements). */
  aiAssistantSuggestions?: EditorAiAssistantItem[];
  aiAssistantWarnings?: EditorAiAssistantItem[];
  aiAssistantImprovements?: EditorAiAssistantItem[];
  /** Quick-fix suggestions (add intro, CTA, FAQ) with apply handler. */
  quickFixSuggestions?: QuickFixSuggestion[];
  onQuickFixApply?: (kind: string) => void;
  quickFixApplyingKind?: string | null;
  quickFixDisabled?: boolean;
};

export function ContentSidePanel({
  shellV1,
  page,
  statusLabel,
  isForsidePage,
  formatDate,
  saveBarProps,
  aiToolsProps,
  unifiedAi = null,
  editorFocusLabel = null,
  aiAssistantSuggestions = [],
  aiAssistantWarnings = [],
  aiAssistantImprovements = [],
  quickFixSuggestions = [],
  onQuickFixApply,
  quickFixApplyingKind = null,
  quickFixDisabled = false,
}: ContentSidePanelProps) {
  const hasAiAssistantItems =
    aiAssistantSuggestions.length > 0 || aiAssistantWarnings.length > 0 || aiAssistantImprovements.length > 0;

  return (
    <div className="space-y-4">
      <section aria-label="Lagring">
        <h2 className="sr-only">Lagring</h2>
        <ContentSaveBar {...saveBarProps} />
      </section>

      {unifiedAi ? (
        <EditorAiUnifiedSuggestions
          seoScore={unifiedAi.seoScore}
          croScore={unifiedAi.croScore}
          aiContentScore={unifiedAi.aiContentScore}
          mediaHealthStatus={unifiedAi.mediaHealthStatus}
          contentHealthStatus={unifiedAi.contentHealthStatus}
          aiCapabilityStatus={unifiedAi.aiCapabilityStatus}
          lastAnalyzedSummary={unifiedAi.lastAnalyzedSummary}
          suggestions={unifiedAi.suggestions}
          onRunAnalysis={unifiedAi.onRunAnalysis}
          runAnalysisBusy={unifiedAi.runAnalysisBusy}
          onApply={unifiedAi.onApply}
          onDismiss={unifiedAi.onDismiss}
          disabled={unifiedAi.disabled}
          contextLabel={editorFocusLabel}
          aiActions={<ContentAiTools {...aiToolsProps} />}
        />
      ) : null}

      {shellV1 && (
        <div className="lp-glass-surface space-y-3 rounded-card px-4 py-3 text-sm">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Sideoppsett</h2>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Metadata og kontekst for denne siden. Brukes til å forstå hvordan siden oppfører seg i systemet.
          </p>
          <div className="space-y-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-3 py-2">
            <p className="text-xs font-medium text-[rgb(var(--lp-text))]">Systemnode</p>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Denne infoen er kun for redaktører. Den påvirker ikke offentlig visning.
            </p>
            {isForsidePage() && (
              <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">
                Dette er forsiden. Systemet har ekstra vern mot sletting.
              </p>
            )}
          </div>

          <dl className="grid gap-2 border-t border-[rgb(var(--lp-border))] pt-4 text-sm">
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Side-ID</dt>
              <dd className="font-mono text-[rgb(var(--lp-text))]">{page?.id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Status</dt>
              <dd>{statusLabel === "published" ? "Publisert" : "Kladd"}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Opprettet</dt>
              <dd>{formatDate(page?.created_at)}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Sist oppdatert</dt>
              <dd>{formatDate(page?.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--lp-muted))]">Publisert</dt>
              <dd>{formatDate(page?.published_at)}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* AI-verktøy moved inside AI-assistent (guided workflow) */}

      {quickFixSuggestions.length > 0 && onQuickFixApply ? (
        <AiQuickFixSuggestions
          suggestions={quickFixSuggestions}
          onApply={onQuickFixApply}
          disabled={quickFixDisabled}
          applyingKind={quickFixApplyingKind}
        />
      ) : null}

      {hasAiAssistantItems ? (
        <EditorAiAssistant
          suggestions={aiAssistantSuggestions}
          warnings={aiAssistantWarnings}
          improvements={aiAssistantImprovements}
        />
      ) : null}

      {shellV1 && (
        <ContentInfoPanel
          page={page}
          statusLabel={statusLabel}
          isForsidePage={isForsidePage}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

