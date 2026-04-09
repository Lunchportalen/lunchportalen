/**
 * FASE 27–28: én importflate for tri-pane + modal shell-byggere + samlet tri-pane bundle-kall.
 * `buildContentWorkspaceTriPaneShellMountPropsFromWorkspaceBundle` eier kjeden av
 * `buildChromeShell*FromFields` → chrome wire + `AuxiliaryShellWireInput` → auxiliary wire.
 * Ingen ny forretningslogikk; ingen alternativ preview-kjede.
 */

import type { AuxiliaryShellWireInput } from "./contentWorkspaceAuxiliaryShellInput";
import {
  chromeShellEditor,
  chromeShellMain,
  chromeShellProperties,
  chromeShellShared,
  chromeShellTri,
} from "./contentWorkspaceChromeShellInput";
import type { ContentWorkspaceTriPaneMountProps } from "./contentWorkspaceTriPaneMountProps";
import { buildContentWorkspaceTriPaneMountAuxiliaryWireFromWorkspaceSlices } from "./contentWorkspaceTriPaneAuxiliaryArgs";
import {
  buildChromeShellEditorSliceFromFields,
  buildChromeShellMainOnlyFromFields,
  buildChromeShellPropertiesSliceFromFields,
  buildChromeShellSharedSliceFromFields,
  buildChromeShellTriSliceFromFields,
  buildContentWorkspaceTriPaneMountChromeWireFromWorkspaceSlices,
  type TriPaneChromeFrameSlice,
} from "./contentWorkspaceTriPaneChromeArgs";

export { buildContentWorkspaceModalShellPropsFromWorkspaceFlatFields } from "./contentWorkspaceModalShellSlices";
export {
  buildAuxiliaryShellAiPitchFromFields,
  buildContentWorkspaceTriPaneMountAuxiliaryWireFromWorkspaceSlices,
} from "./contentWorkspaceTriPaneAuxiliaryArgs";
export {
  buildChromeShellEditorSliceFromFields,
  buildChromeShellMainOnlyFromFields,
  buildChromeShellPropertiesSliceFromFields,
  buildChromeShellSharedSliceFromFields,
  buildChromeShellTriSliceFromFields,
  buildContentWorkspaceTriPaneMountChromeWireFromWorkspaceSlices,
} from "./contentWorkspaceTriPaneChromeArgs";

/** Navngitte chrome-tupler før slice-byggere — parent kaller ikke lenger `buildChromeShell*FromFields` enkeltvis. */
export type ContentWorkspaceTriPaneShellBundleChromeInput = {
  shared: Parameters<typeof chromeShellShared>;
  editor: Parameters<typeof chromeShellEditor>;
  main: Parameters<typeof chromeShellMain>;
  properties: Parameters<typeof chromeShellProperties>;
  tri: Parameters<typeof chromeShellTri>;
};

/** Én typed input: frame + chrome-tupler + ferdig `AuxiliaryShellWireInput` (identity/detail/save/pageBody/aiPitch). */
export type ContentWorkspaceTriPaneShellBundleWorkspaceInput = {
  frame: TriPaneChromeFrameSlice;
  chrome: ContentWorkspaceTriPaneShellBundleChromeInput;
  auxiliary: AuxiliaryShellWireInput;
};

export function buildContentWorkspaceTriPaneShellMountPropsFromWorkspaceBundle(
  input: ContentWorkspaceTriPaneShellBundleWorkspaceInput
): ContentWorkspaceTriPaneMountProps {
  return {
    chromeWire: buildContentWorkspaceTriPaneMountChromeWireFromWorkspaceSlices({
      frame: input.frame,
      shared: buildChromeShellSharedSliceFromFields(...input.chrome.shared),
      editor: buildChromeShellEditorSliceFromFields(...input.chrome.editor),
      main: buildChromeShellMainOnlyFromFields(...input.chrome.main),
      properties: buildChromeShellPropertiesSliceFromFields(...input.chrome.properties),
      tri: buildChromeShellTriSliceFromFields(...input.chrome.tri),
    }),
    auxiliaryWire: buildContentWorkspaceTriPaneMountAuxiliaryWireFromWorkspaceSlices(input.auxiliary),
  };
}

export { ContentWorkspaceTriPaneMount } from "./contentWorkspaceTriPaneShellViewModel";
