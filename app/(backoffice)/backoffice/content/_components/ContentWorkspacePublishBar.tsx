"use client";

/**
 * Lower editor chrome: version history strip + save bar (publish flow affordances).
 * No domain or transport logic — props only.
 */

import { ContentSaveBar } from "./ContentSaveBar";
import {
  ContentPageVersionHistory,
  type HistoryPreviewPayload,
  type RestoredPagePayload,
} from "./ContentPageVersionHistory";

export type ContentWorkspacePublishBarProps = {
  isDemo: boolean;
  versionHistory: {
    pageId: string;
    locale: string;
    environment: string;
    pageUpdatedAt: string | null;
    disabled: boolean;
    onApplyHistoryPreview: (payload: HistoryPreviewPayload) => void;
    onApplyRestoredPage: (restored: RestoredPagePayload) => void;
  };
  saveBar: {
    selectedId: string;
    saving: boolean;
    canSave: boolean;
    onSaveAndPreview: () => void | Promise<void>;
    onSave: () => void | Promise<void>;
  };
};

/** @deprecated Prefer `ContentWorkspacePublishBar` — alias kept for existing shells. */
export type ContentWorkspaceEditorLowerControlsProps = ContentWorkspacePublishBarProps;

export function ContentWorkspacePublishBar({ isDemo, versionHistory, saveBar }: ContentWorkspacePublishBarProps) {
  if (isDemo) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--lp-border))]/80 bg-white shadow-sm">
        <div className="border-b border-[rgb(var(--lp-border))]/70 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Lagring</p>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Ett samlet felt for manuell lagring og trygg preview.</p>
        </div>
        <ContentSaveBar
          selectedId={saveBar.selectedId}
          saving={saveBar.saving}
          canSave={saveBar.canSave}
          onSaveAndPreview={saveBar.onSaveAndPreview}
          onSave={saveBar.onSave}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[rgb(var(--lp-border))]/80 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[rgb(var(--lp-border))]/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Publisering og historikk</p>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Versjoner, gjenoppretting og lagring ligger samlet i én roligere sone under editoren.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ContentPageVersionHistory
            pageId={versionHistory.pageId}
            locale={versionHistory.locale}
            environment={versionHistory.environment}
            pageUpdatedAt={versionHistory.pageUpdatedAt}
            disabled={versionHistory.disabled}
            onApplyHistoryPreview={versionHistory.onApplyHistoryPreview}
            onApplyRestoredPage={versionHistory.onApplyRestoredPage}
          />
        </div>
      </div>
      <ContentSaveBar
        selectedId={saveBar.selectedId}
        saving={saveBar.saving}
        canSave={saveBar.canSave}
        onSaveAndPreview={saveBar.onSaveAndPreview}
        onSave={saveBar.onSave}
      />
    </div>
  );
}

/** @deprecated Prefer `ContentWorkspacePublishBar` — alias kept for existing shells. */
export const ContentWorkspaceEditorLowerControls = ContentWorkspacePublishBar;
