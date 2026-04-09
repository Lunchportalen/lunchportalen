/**
 * Auxiliary shell input — typer, gruppering og `auxiliaryShell*`-fabrikker.
 * Ren pass-through til `buildContentWorkspaceAuxiliaryShellProps`; ingen domene-/preview-logikk.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { HistoryPreviewPayload } from "./ContentPageVersionHistory";
import type { Block } from "./editorBlockTypes";
import type { ContentPage } from "./ContentWorkspaceState";
import type { BuildContentWorkspaceAuxiliaryShellPropsArgs } from "./contentWorkspaceAuxiliaryShellProps";

export type AuxiliaryShellIdentity = Pick<
  BuildContentWorkspaceAuxiliaryShellPropsArgs,
  "isDemo" | "isWow" | "effectiveId" | "page" | "editorLocale"
>;

export type AuxiliaryShellDetail = Pick<
  BuildContentWorkspaceAuxiliaryShellPropsArgs,
  "isOffline" | "detailLoading" | "pageNotFound" | "detailError" | "selectedId"
>;

export type AuxiliaryShellSave = Pick<
  BuildContentWorkspaceAuxiliaryShellPropsArgs,
  | "saving"
  | "canSave"
  | "onSaveAndPreview"
  | "onSave"
  | "setHistoryVersionPreview"
  | "setShowPreviewColumn"
  | "clearAutosaveTimer"
>;

export type AuxiliaryShellPageBody = Pick<
  BuildContentWorkspaceAuxiliaryShellPropsArgs,
  | "setTitle"
  | "setSlug"
  | "setSlugTouched"
  | "applyParsedBody"
  | "setSavedSnapshot"
  | "setPage"
  | "updateSidebarItem"
  | "setLastSavedAt"
  | "setSaveStateSafe"
  | "setLastError"
>;

export type AuxiliaryShellAiPitch = Pick<
  BuildContentWorkspaceAuxiliaryShellPropsArgs,
  | "isPitch"
  | "aiProduct"
  | "setAiProduct"
  | "aiAudience"
  | "setAiAudience"
  | "aiIntent"
  | "setAiIntent"
  | "runAiBuild"
  | "aiBuildLoading"
  | "runAiAudit"
  | "aiAuditLoading"
  | "onboardingStep"
  | "setOnboardingStep"
  | "aiBuildResult"
  | "setBlocks"
  | "selectedBlock"
  | "imagePresetLabels"
  | "imagePreset"
  | "setImagePreset"
  | "runAiImage"
  | "runAiImageBatch"
  | "aiAnyLoading"
  | "aiImageLoading"
  | "aiBatchLoading"
  | "runAiAction"
  | "aiBatchProgress"
  | "aiImages"
  | "applyImage"
  | "demoBlocks"
  | "setSelectedBlockId"
  | "setOriginalBlocks"
  | "setShowAfter"
  | "wowHasRunRef"
>;

export type AuxiliaryShellWireInput = {
  identity: AuxiliaryShellIdentity;
  detail: AuxiliaryShellDetail;
  save: AuxiliaryShellSave;
  pageBody: AuxiliaryShellPageBody;
  aiPitch: AuxiliaryShellAiPitch;
};

export function mergeAuxiliaryShellInput(groups: AuxiliaryShellWireInput): BuildContentWorkspaceAuxiliaryShellPropsArgs {
  return {
    ...groups.identity,
    ...groups.detail,
    ...groups.save,
    ...groups.pageBody,
    ...groups.aiPitch,
  };
}

/** Wire med 5 grupper → flat args til `buildContentWorkspaceAuxiliaryShellProps`. */
export function buildWorkspaceAuxiliaryShellArgs(
  w: AuxiliaryShellWireInput
): BuildContentWorkspaceAuxiliaryShellPropsArgs {
  return mergeAuxiliaryShellInput(w);
}

export function auxiliaryShellIdentity(
  isDemo: boolean,
  isWow: boolean,
  effectiveId: string | null,
  page: ContentPage | null,
  editorLocale: string
): AuxiliaryShellIdentity {
  return { isDemo, isWow, effectiveId, page, editorLocale };
}

export function auxiliaryShellDetail(
  isOffline: boolean,
  detailLoading: boolean,
  pageNotFound: boolean,
  detailError: unknown,
  selectedId: string
): AuxiliaryShellDetail {
  return { isOffline, detailLoading, pageNotFound, detailError, selectedId };
}

export function auxiliaryShellSave(
  saving: boolean,
  canSave: boolean,
  onSaveAndPreview: () => void | Promise<void>,
  onSave: () => void | Promise<void>,
  setHistoryVersionPreview: (p: HistoryPreviewPayload | null) => void,
  setShowPreviewColumn: (v: boolean) => void,
  clearAutosaveTimer: () => void
): AuxiliaryShellSave {
  return {
    saving,
    canSave,
    onSaveAndPreview,
    onSave,
    setHistoryVersionPreview,
    setShowPreviewColumn,
    clearAutosaveTimer,
  };
}

export function auxiliaryShellPageBody(
  setTitle: (v: string) => void,
  setSlug: (v: string) => void,
  setSlugTouched: (v: boolean) => void,
  applyParsedBody: BuildContentWorkspaceAuxiliaryShellPropsArgs["applyParsedBody"],
  setSavedSnapshot: BuildContentWorkspaceAuxiliaryShellPropsArgs["setSavedSnapshot"],
  setPage: BuildContentWorkspaceAuxiliaryShellPropsArgs["setPage"],
  updateSidebarItem: BuildContentWorkspaceAuxiliaryShellPropsArgs["updateSidebarItem"],
  setLastSavedAt: (v: string) => void,
  setSaveStateSafe: BuildContentWorkspaceAuxiliaryShellPropsArgs["setSaveStateSafe"],
  setLastError: (v: string | null) => void
): AuxiliaryShellPageBody {
  return {
    setTitle,
    setSlug,
    setSlugTouched,
    applyParsedBody,
    setSavedSnapshot,
    setPage,
    updateSidebarItem,
    setLastSavedAt,
    setSaveStateSafe,
    setLastError,
  };
}

export function auxiliaryShellAiPitch(
  isPitch: boolean,
  aiProduct: string,
  setAiProduct: (v: string) => void,
  aiAudience: string,
  setAiAudience: (v: string) => void,
  aiIntent: string,
  setAiIntent: (v: string) => void,
  runAiBuild: () => void | Promise<void>,
  aiBuildLoading: boolean,
  runAiAudit: () => void | Promise<void>,
  aiAuditLoading: boolean,
  onboardingStep: number,
  setOnboardingStep: (n: number | ((p: number) => number)) => void,
  aiBuildResult: unknown[] | null,
  setBlocks: Dispatch<SetStateAction<Block[]>>,
  selectedBlock: Block | null,
  imagePresetLabels: Record<string, string>,
  imagePreset: string,
  setImagePreset: (k: string) => void,
  runAiImage: () => void | Promise<void>,
  runAiImageBatch: () => void | Promise<void>,
  aiAnyLoading: boolean,
  aiImageLoading: boolean,
  aiBatchLoading: boolean,
  runAiAction: (kind: "improve" | "shorten" | "seo") => void | Promise<void>,
  aiBatchProgress: { done: number; total: number },
  aiImages: { url: string }[] | null,
  applyImage: (picked: { url: string; assetId?: string }) => void,
  demoBlocks: Block[],
  setSelectedBlockId: (id: string | null) => void,
  setOriginalBlocks: (b: Block[]) => void,
  setShowAfter: (v: boolean | ((p: boolean) => boolean)) => void,
  wowHasRunRef: MutableRefObject<boolean>
): AuxiliaryShellAiPitch {
  return {
    isPitch,
    aiProduct,
    setAiProduct,
    aiAudience,
    setAiAudience,
    aiIntent,
    setAiIntent,
    runAiBuild,
    aiBuildLoading,
    runAiAudit,
    aiAuditLoading,
    onboardingStep,
    setOnboardingStep,
    aiBuildResult,
    setBlocks,
    selectedBlock,
    imagePresetLabels,
    imagePreset,
    setImagePreset,
    runAiImage,
    runAiImageBatch,
    aiAnyLoading,
    aiImageLoading,
    aiBatchLoading,
    runAiAction,
    aiBatchProgress,
    aiImages,
    applyImage,
    demoBlocks,
    setSelectedBlockId,
    setOriginalBlocks,
    setShowAfter,
    wowHasRunRef,
  };
}
