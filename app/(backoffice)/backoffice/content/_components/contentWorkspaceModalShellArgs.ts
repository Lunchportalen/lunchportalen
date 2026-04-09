/**
 * Modal-shell args-slicing — grupperer `BuildContentWorkspaceModalShellPropsArgs` i tre tydelige flater.
 * Pass-through til `buildContentWorkspaceModalShellProps`; ingen ny forretningslogikk.
 */

import { buildContentWorkspaceModalShellProps } from "./contentWorkspaceModalShellProps";
import type { BuildContentWorkspaceModalShellPropsArgs } from "./contentWorkspaceModalShellProps";
import type { ContentWorkspaceModalShellProps } from "./ContentWorkspaceModalShell";

export type ModalShellFullPageAiSlice = Pick<
  BuildContentWorkspaceModalShellPropsArgs,
  | "aiFullPageModalOpen"
  | "closeAiFullPageModal"
  | "aiFullPageModalPrompt"
  | "setAiFullPageModalPrompt"
  | "aiFullPageBusy"
  | "aiFullPageError"
  | "aiFullPagePreview"
  | "aiFullPagePreviewBlocks"
  | "aiFullPageReplaceOk"
  | "setAiFullPageReplaceOk"
  | "aiFullPageAlsoTitle"
  | "setAiFullPageAlsoTitle"
  | "onAiFullPageModalGenerate"
  | "onAiFullPageModalApply"
>;

export type ModalShellBlockAndPickerSlice = Pick<
  BuildContentWorkspaceModalShellPropsArgs,
  | "blockPickerOpen"
  | "page"
  | "slug"
  | "title"
  | "isForside"
  | "setBlockPickerOpen"
  | "addInsertIndexRef"
  | "setBodyMode"
  | "setBodyParseError"
  | "setLegacyBodyText"
  | "setInvalidBodyRaw"
  | "setBlocks"
  | "setSelectedBlockId"
  | "editOpen"
  | "blocks"
  | "editIndex"
  | "setEditModalLiveBlock"
  | "setEditOpen"
  | "setEditIndex"
  | "onDeleteBlock"
  | "mediaPickerOpen"
  | "mediaPickerTarget"
  | "setMediaPickerOpen"
  | "setMediaPickerTarget"
  | "setBlockById"
  | "documentTypeAlias"
  | "mergedBlockEditorDataTypes"
  | "mergedDocumentTypeDefinitions"
>;

export type ModalShellOnboardingPitchSlice = Pick<
  BuildContentWorkspaceModalShellPropsArgs,
  | "onboardingStep"
  | "setOnboardingStep"
  | "onboardingDoneKey"
  | "isPitch"
  | "pitchStep"
  | "runAiAction"
  | "runAiAudit"
  | "runAiImage"
  | "setShowAfter"
  | "setPitchStep"
>;

export function buildContentWorkspaceModalShellPropsFromWorkspaceSlices(slices: {
  fullPageAi: ModalShellFullPageAiSlice;
  blockAndPicker: ModalShellBlockAndPickerSlice;
  onboardingPitch: ModalShellOnboardingPitchSlice;
}): ContentWorkspaceModalShellProps {
  return buildContentWorkspaceModalShellProps({
    ...slices.fullPageAi,
    ...slices.blockAndPicker,
    ...slices.onboardingPitch,
  });
}
