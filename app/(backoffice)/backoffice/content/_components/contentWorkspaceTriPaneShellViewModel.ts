/**
 * Tri-pane shell wire — grupperer fabrikk-resultater til `ChromeShellWireInput` / `AuxiliaryShellWireInput`.
 * Ren presentasjon; ingen ny forretningslogikk; ingen alternativ preview-kjede.
 */

import type {
  AuxiliaryShellAiPitch,
  AuxiliaryShellDetail,
  AuxiliaryShellIdentity,
  AuxiliaryShellPageBody,
  AuxiliaryShellSave,
  AuxiliaryShellWireInput,
} from "./contentWorkspaceAuxiliaryShellInput";
import type {
  ChromeShellEditorOnly,
  ChromeShellFrame,
  ChromeShellMainOnly,
  ChromeShellProperties,
  ChromeShellShared,
  ChromeShellTri,
  ChromeShellWireInput,
} from "./contentWorkspaceChromeShellInput";

export function buildContentWorkspaceTriPaneMountChromeWire(
  frame: ChromeShellFrame,
  shared: ChromeShellShared,
  editor: ChromeShellEditorOnly,
  main: ChromeShellMainOnly,
  properties: ChromeShellProperties,
  tri: ChromeShellTri
): ChromeShellWireInput {
  return { frame, shared, editor, main, properties, tri };
}

export function buildContentWorkspaceTriPaneMountAuxiliaryWire(
  identity: AuxiliaryShellIdentity,
  detail: AuxiliaryShellDetail,
  save: AuxiliaryShellSave,
  pageBody: AuxiliaryShellPageBody,
  aiPitch: AuxiliaryShellAiPitch
): AuxiliaryShellWireInput {
  return { identity, detail, save, pageBody, aiPitch };
}

export { ContentWorkspaceTriPaneMount } from "./ContentWorkspaceTriPaneMount";
