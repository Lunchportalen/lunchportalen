"use client";

import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { BlockList } from "./_stubs";
import type { PageStatus } from "./contentWorkspace.types";
import type { ContentPage } from "./ContentWorkspaceState";
import type { StatusLineState } from "./types";
import type { ContentWorkspaceConflictStatusShellProps } from "./ContentWorkspaceConflictStatusShell";
import { ContentWorkspaceConflictStatusShell } from "./ContentWorkspaceConflictStatusShell";
import {
  ContentWorkspaceDetailErrorShell,
  ContentWorkspaceDetailLoadingShell,
  ContentWorkspaceEditorAreaLoadingShell,
  ContentWorkspaceEmptySelectionShell,
  ContentWorkspacePageNotFoundShell,
  ContentWorkspacePendingNavigationBanner,
} from "./contentWorkspaceShellMountFragments";
import type { ContentWorkspaceDesignTailShellProps } from "./ContentWorkspaceDesignTailShell";
import type { ContentWorkspaceGlobalMainViewShellProps } from "./ContentWorkspaceGlobalMainViewShell";
import type { ContentWorkspaceGlobalMainViewShellContProps } from "./ContentWorkspaceGlobalMainViewShellCont";
import type { ContentWorkspaceGlobalGlobalBranchShellProps } from "./ContentWorkspaceGlobalGlobalBranchShell";
import type { ContentWorkspaceTriPaneShellBundleWorkspaceInput } from "./contentWorkspaceTriPaneShellBundle";
import type { ContentGovernedPosture, WorkspaceHistoryStatus } from "@/lib/cms/backofficeWorkspaceContextModel";
import type { GlobalSubView } from "./useContentWorkspaceShell";
import type { HistoryPreviewPayload, RestoredPagePayload } from "./ContentPageVersionHistory";

/** Rå felter for Editor2-mount beholdes kun som typed input for shell-modellen. */
export type ContentWorkspaceEditor2MountInput = {
  page: ContentPage | null;
  editor2Model: BlockList | null;
  setEditor2Model: Dispatch<SetStateAction<BlockList | null>>;
  editor2SelectedBlockId: string | null;
  setEditor2SelectedBlockId: Dispatch<SetStateAction<string | null>>;
  editor2PendingFocusIdRef: MutableRefObject<string | null>;
  statusLine: StatusLineState;
  onSetStatus: (nextStatus: PageStatus) => Promise<void>;
  performSave: () => Promise<boolean>;
  reloadDetailFromServer: () => void | Promise<void>;
  canPublish: boolean;
  canUnpublish: boolean;
  canSave: boolean;
  isPublished: boolean;
  editor2Validation: { byId: Record<string, string[]>; total: number; firstId: string | null };
  editor2FocusNonce: number;
  setEditor2FocusNonce: Dispatch<SetStateAction<number>>;
  editor2BlockListRef: RefObject<HTMLDivElement | null>;
  editor2ResetSearchNonce: number;
};

export type ContentWorkspacePageEditorShellProps = {
  pendingNavigationHref: string | null;
  confirmPendingNavigation: () => void;
  cancelPendingNavigation: () => void;
  globalSubView: GlobalSubView;
  designTail: ContentWorkspaceDesignTailShellProps;
  globalMainView: ContentWorkspaceGlobalMainViewShellProps;
  globalMainViewCont: ContentWorkspaceGlobalMainViewShellContProps;
  globalBranchProps: ContentWorkspaceGlobalGlobalBranchShellProps;
  selectedId: string;
  pageNotFound: boolean;
  detailLoading: boolean;
  detailError: string | null;
  page: ContentPage | null;
  hasConflict: boolean;
  guardPush: (href: string) => void;
  conflictShellProps: ContentWorkspaceConflictStatusShellProps;
  useEditor2: boolean;
  editor2MountInput: ContentWorkspaceEditor2MountInput;
  triPaneBundleInput: ContentWorkspaceTriPaneShellBundleWorkspaceInput;
  historyView: {
    pageId: string;
    locale: string;
    environment: string;
    pageUpdatedAt: string | null;
    historyStatus: WorkspaceHistoryStatus;
    documentTypeAlias: string | null;
    governedPosture: ContentGovernedPosture;
    publishState: "draft" | "published";
    previewHref: string | null;
    onApplyHistoryPreview: (payload: HistoryPreviewPayload) => void;
    onApplyRestoredPage: (page: RestoredPagePayload) => void;
  };
};

/**
 * Page/detail state shell for content + preview workspace views.
 * Renders banners and fail-closed detail states only. Workspace surfaces live in ContentWorkspace.tsx.
 */
export function ContentWorkspacePageEditorShell(props: ContentWorkspacePageEditorShellProps) {
  const {
    pendingNavigationHref,
    confirmPendingNavigation,
    cancelPendingNavigation,
    selectedId,
    pageNotFound,
    detailLoading,
    detailError,
    page,
    hasConflict,
    guardPush,
    conflictShellProps,
  } = props;

  return (
    <>
      {pendingNavigationHref ? (
        <ContentWorkspacePendingNavigationBanner onConfirm={confirmPendingNavigation} onCancel={cancelPendingNavigation} />
      ) : !selectedId ? (
        <ContentWorkspaceEmptySelectionShell />
      ) : pageNotFound ? (
        <ContentWorkspacePageNotFoundShell onBackToOverview={() => guardPush("/backoffice/content")} />
      ) : detailLoading ? (
        <ContentWorkspaceDetailLoadingShell />
      ) : detailError ? (
        <ContentWorkspaceDetailErrorShell message={detailError} />
      ) : page && hasConflict ? (
        <ContentWorkspaceConflictStatusShell {...conflictShellProps} />
      ) : page ? null : selectedId ? (
        <ContentWorkspaceEditorAreaLoadingShell />
      ) : null}
    </>
  );
}
