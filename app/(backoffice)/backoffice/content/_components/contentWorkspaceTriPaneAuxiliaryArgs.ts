/**
 * Tri-pane auxiliary wire — grupperer input til `buildContentWorkspaceTriPaneMountAuxiliaryWire`.
 * Ren pass-through til `auxiliaryShell*`; ingen ny forretningslogikk; ingen alternativ preview-kjede.
 */

import {
  auxiliaryShellAiPitch,
  type AuxiliaryShellAiPitch,
  type AuxiliaryShellWireInput,
} from "./contentWorkspaceAuxiliaryShellInput";
import { buildContentWorkspaceTriPaneMountAuxiliaryWire } from "./contentWorkspaceTriPaneShellViewModel";

/** Pass-through til `auxiliaryShellAiPitch` — én linje der `AuxiliaryShellAiPitch` bygges fra posisjonelle args. */
export function buildAuxiliaryShellAiPitchFromFields(
  ...args: Parameters<typeof auxiliaryShellAiPitch>
): AuxiliaryShellAiPitch {
  return auxiliaryShellAiPitch(...args);
}

/**
 * `identity` / `detail` / `save` / `pageBody` / `aiPitch` er samme objekter som `AuxiliaryShellWireInput` (FASE 28).
 * Parent eier ikke lenger tupler spredd til `auxiliaryShellIdentity` osv.
 */
export function buildContentWorkspaceTriPaneMountAuxiliaryWireFromWorkspaceSlices(
  s: AuxiliaryShellWireInput
): AuxiliaryShellWireInput {
  return buildContentWorkspaceTriPaneMountAuxiliaryWire(
    s.identity,
    s.detail,
    s.save,
    s.pageBody,
    s.aiPitch
  );
}
