import type { AuxiliaryShellWireInput } from "./contentWorkspaceAuxiliaryShellInput";
import type { ChromeShellWireInput } from "./contentWorkspaceChromeShellInput";

/** Typed tri-pane mount — kun wire-referanser; ingen domene-/preview-logikk. */
export type ContentWorkspaceTriPaneMountProps = {
  chromeWire: ChromeShellWireInput;
  auxiliaryWire: AuxiliaryShellWireInput;
};
