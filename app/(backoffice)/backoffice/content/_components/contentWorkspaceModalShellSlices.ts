/**
 * Modal-shell slice-gruppering — tynn fasade over `contentWorkspaceModalShellArgs.ts`.
 * Kun pass-through; ingen ny forretningslogikk; ingen alternativ preview-kjede.
 */

import { buildContentWorkspaceModalShellProps } from "./contentWorkspaceModalShellProps";
import type { BuildContentWorkspaceModalShellPropsArgs } from "./contentWorkspaceModalShellProps";
import type { ContentWorkspaceModalShellProps } from "./ContentWorkspaceModalShell";

export {
  buildContentWorkspaceModalShellPropsFromWorkspaceSlices,
  type ModalShellBlockAndPickerSlice,
  type ModalShellFullPageAiSlice,
  type ModalShellOnboardingPitchSlice,
} from "./contentWorkspaceModalShellArgs";

/** Flat `BuildContentWorkspaceModalShellPropsArgs` → `buildContentWorkspaceModalShellProps` (FASE 27). */
export function buildContentWorkspaceModalShellPropsFromWorkspaceFlatFields(
  p: BuildContentWorkspaceModalShellPropsArgs
): ContentWorkspaceModalShellProps {
  return buildContentWorkspaceModalShellProps(p);
}
