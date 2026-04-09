/**
 * FASE 33: Page-editor shell input assembly — props-only.
 * Bygger `designTail` / global / konflikt / Editor2 / tri-pane bundle uten ny forretningslogikk eller alternativ preview-kjede.
 */

import type { ContentWorkspaceConflictStatusShellProps } from "./ContentWorkspaceConflictStatusShell";
import type { ContentWorkspaceDesignTailShellProps } from "./ContentWorkspaceDesignTailShell";
import type { ContentWorkspaceGlobalGlobalBranchShellProps } from "./ContentWorkspaceGlobalGlobalBranchShell";
import type { ContentWorkspaceGlobalMainViewShellContProps } from "./ContentWorkspaceGlobalMainViewShellCont";
import type { ContentWorkspaceGlobalMainViewShellProps } from "./ContentWorkspaceGlobalMainViewShell";
import type {
  ContentWorkspaceEditor2MountInput,
  ContentWorkspacePageEditorShellProps,
} from "./ContentWorkspacePageEditorShell";
import type {
  AuxiliaryShellAiPitch,
  AuxiliaryShellDetail,
  AuxiliaryShellIdentity,
  AuxiliaryShellPageBody,
  AuxiliaryShellSave,
} from "./contentWorkspaceAuxiliaryShellInput";
import {
  auxiliaryShellAiPitch,
  auxiliaryShellDetail,
  auxiliaryShellIdentity,
  auxiliaryShellPageBody,
  auxiliaryShellSave,
} from "./contentWorkspaceAuxiliaryShellInput";
import type { ContentWorkspaceTriPaneShellBundleChromeInput } from "./contentWorkspaceTriPaneShellBundle";
import type { TriPaneChromeFrameSlice } from "./contentWorkspaceTriPaneChromeArgs";

export type ContentWorkspacePageEditorShellBundleFields = ContentWorkspaceDesignTailShellProps &
  ContentWorkspaceGlobalMainViewShellProps &
  ContentWorkspaceGlobalMainViewShellContProps &
  ContentWorkspaceGlobalGlobalBranchShellProps &
  ContentWorkspaceConflictStatusShellProps &
  ContentWorkspaceEditor2MountInput &
  TriPaneChromeFrameSlice & {
    chrome: ContentWorkspaceTriPaneShellBundleChromeInput;
  } &
  AuxiliaryShellIdentity &
  AuxiliaryShellDetail &
  AuxiliaryShellSave &
  AuxiliaryShellPageBody &
  AuxiliaryShellAiPitch;

export type ContentWorkspacePageEditorShellBundle = Pick<
  ContentWorkspacePageEditorShellProps,
  | "designTail"
  | "globalMainView"
  | "globalMainViewCont"
  | "globalBranchProps"
  | "conflictShellProps"
  | "editor2MountInput"
  | "triPaneBundleInput"
>;

export function buildContentWorkspacePageEditorShellBundle(
  f: ContentWorkspacePageEditorShellBundleFields
): ContentWorkspacePageEditorShellBundle {
  const designTail: ContentWorkspaceDesignTailShellProps = {
    designTab: f.designTab,
    setDesignTab: f.setDesignTab,
    colorsContentBg: f.colorsContentBg,
    colorsButtonBg: f.colorsButtonBg,
    colorsButtonText: f.colorsButtonText,
    colorsButtonBorder: f.colorsButtonBorder,
    setColorsContentBg: f.setColorsContentBg,
    setColorsButtonBg: f.setColorsButtonBg,
    setColorsButtonText: f.setColorsButtonText,
    setColorsButtonBorder: f.setColorsButtonBorder,
    labelColors: f.labelColors,
    setLabelColors: f.setLabelColors,
  };

  const globalMainView: ContentWorkspaceGlobalMainViewShellProps = {
    exitGlobalSubView: f.exitGlobalSubView,
    contentSettingsTab: f.contentSettingsTab,
    setContentSettingsTab: f.setContentSettingsTab,
    contentDirection: f.contentDirection,
    setContentDirection: f.setContentDirection,
  };

  const globalMainViewCont: ContentWorkspaceGlobalMainViewShellContProps = {
    contentSettingsTab: f.contentSettingsTab,
    emailPlatform: f.emailPlatform,
    setEmailPlatform: f.setEmailPlatform,
    captchaVersion: f.captchaVersion,
    setCaptchaVersion: f.setCaptchaVersion,
    notificationEnabled: f.notificationEnabled,
    setNotificationEnabled: f.setNotificationEnabled,
  };

  const globalBranchProps: ContentWorkspaceGlobalGlobalBranchShellProps = {
    globalSubView: f.globalSubView,
    exitGlobalSubView: f.exitGlobalSubView,
    globalPanelTab: f.globalPanelTab,
    setGlobalPanelTab: f.setGlobalPanelTab,
    openGlobalSubViewCard: f.openGlobalSubViewCard,
    headerVariant: f.headerVariant,
    setHeaderVariant: f.setHeaderVariant,
    headerEditConfig: f.headerEditConfig,
    setHeaderEditConfig: f.setHeaderEditConfig,
    headerEditLoading: f.headerEditLoading,
    setHeaderEditLoading: f.setHeaderEditLoading,
    headerEditError: f.headerEditError,
    setHeaderEditError: f.setHeaderEditError,
    headerEditSaving: f.headerEditSaving,
    setHeaderEditSaving: f.setHeaderEditSaving,
    footerTab: f.footerTab,
    setFooterTab: f.setFooterTab,
    navigationTab: f.navigationTab,
    setNavigationTab: f.setNavigationTab,
    hideMainNavigation: f.hideMainNavigation,
    setHideMainNavigation: f.setHideMainNavigation,
    hideSecondaryNavigation: f.hideSecondaryNavigation,
    setHideSecondaryNavigation: f.setHideSecondaryNavigation,
    hideFooterNavigation: f.hideFooterNavigation,
    setHideFooterNavigation: f.setHideFooterNavigation,
    hideMemberNavigation: f.hideMemberNavigation,
    setHideMemberNavigation: f.setHideMemberNavigation,
    hideCtaNavigation: f.hideCtaNavigation,
    setHideCtaNavigation: f.setHideCtaNavigation,
    hideLanguageNavigation: f.hideLanguageNavigation,
    setHideLanguageNavigation: f.setHideLanguageNavigation,
    multilingualMode: f.multilingualMode,
    setMultilingualMode: f.setMultilingualMode,
  };

  const conflictShellProps: ContentWorkspaceConflictStatusShellProps = {
    statusLine: f.statusLine,
    supportSnapshot: f.supportSnapshot,
    supportCopyFeedback: f.supportCopyFeedback,
    copySupportSnapshot: f.copySupportSnapshot,
    reloadDetailFromServer: f.reloadDetailFromServer,
    isOffline: f.isOffline,
    guardPush: f.guardPush,
  };

  const editor2MountInput: ContentWorkspaceEditor2MountInput = {
    page: f.page,
    editor2Model: f.editor2Model,
    setEditor2Model: f.setEditor2Model,
    editor2SelectedBlockId: f.editor2SelectedBlockId,
    setEditor2SelectedBlockId: f.setEditor2SelectedBlockId,
    editor2PendingFocusIdRef: f.editor2PendingFocusIdRef,
    statusLine: f.statusLine,
    onSetStatus: f.onSetStatus,
    performSave: f.performSave,
    reloadDetailFromServer: f.reloadDetailFromServer,
    canPublish: f.canPublish,
    canUnpublish: f.canUnpublish,
    canSave: f.canSave,
    isPublished: f.isPublished,
    editor2Validation: f.editor2Validation,
    editor2FocusNonce: f.editor2FocusNonce,
    setEditor2FocusNonce: f.setEditor2FocusNonce,
    editor2BlockListRef: f.editor2BlockListRef,
    editor2ResetSearchNonce: f.editor2ResetSearchNonce,
  };

  const identity: AuxiliaryShellIdentity = auxiliaryShellIdentity(
    f.isDemo,
    f.isWow,
    f.effectiveId,
    f.page,
    f.editorLocale
  );
  const detail: AuxiliaryShellDetail = auxiliaryShellDetail(
    f.isOffline,
    f.detailLoading,
    f.pageNotFound,
    f.detailError,
    f.selectedId
  );
  const save: AuxiliaryShellSave = auxiliaryShellSave(
    f.saving,
    f.canSave,
    f.onSaveAndPreview,
    f.onSave,
    f.setHistoryVersionPreview,
    f.setShowPreviewColumn,
    f.clearAutosaveTimer
  );
  const pageBody: AuxiliaryShellPageBody = auxiliaryShellPageBody(
    f.setTitle,
    f.setSlug,
    f.setSlugTouched,
    f.applyParsedBody,
    f.setSavedSnapshot,
    f.setPage,
    f.updateSidebarItem,
    f.setLastSavedAt,
    f.setSaveStateSafe,
    f.setLastError
  );
  const aiPitch: AuxiliaryShellAiPitch = auxiliaryShellAiPitch(
    f.isPitch,
    f.aiProduct,
    f.setAiProduct,
    f.aiAudience,
    f.setAiAudience,
    f.aiIntent,
    f.setAiIntent,
    f.runAiBuild,
    f.aiBuildLoading,
    f.runAiAudit,
    f.aiAuditLoading,
    f.onboardingStep,
    f.setOnboardingStep,
    f.aiBuildResult,
    f.setBlocks,
    f.selectedBlock,
    f.imagePresetLabels,
    f.imagePreset,
    f.setImagePreset,
    f.runAiImage,
    f.runAiImageBatch,
    f.aiAnyLoading,
    f.aiImageLoading,
    f.aiBatchLoading,
    f.runAiAction,
    f.aiBatchProgress,
    f.aiImages,
    f.applyImage,
    f.demoBlocks,
    f.setSelectedBlockId,
    f.setOriginalBlocks,
    f.setShowAfter,
    f.wowHasRunRef
  );

  return {
    designTail,
    globalMainView,
    globalMainViewCont,
    globalBranchProps,
    conflictShellProps,
    editor2MountInput,
    triPaneBundleInput: {
      frame: {
        page: f.page,
        isContentTab: f.isContentTab,
        hideLegacyNav: f.hideLegacyNav,
        editorCanvasRef: f.editorCanvasRef,
        rightRailSlots: f.rightRailSlots,
      },
      chrome: f.chrome,
      auxiliary: {
        identity,
        detail,
        save,
        pageBody,
        aiPitch,
      },
    },
  };
}
