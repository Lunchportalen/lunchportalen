/**
 * Tri-pane chrome wire — grupperer input til `buildContentWorkspaceTriPaneMountChromeWire`.
 * Ren pass-through til `chromeShell*`; ingen ny forretningslogikk; ingen alternativ preview-kjede.
 */

import {
  buildContentWorkspaceTriPaneMountChromeWire,
} from "./contentWorkspaceTriPaneShellViewModel";
import {
  chromeShellEditor,
  chromeShellFrame,
  chromeShellMain,
  chromeShellProperties,
  chromeShellShared,
  chromeShellTri,
  type ChromeShellEditorOnly,
  type ChromeShellMainOnly,
  type ChromeShellProperties,
  type ChromeShellShared,
  type ChromeShellTri,
  type ChromeShellWireInput,
} from "./contentWorkspaceChromeShellInput";
import type { ContentPage } from "./ContentWorkspaceState";
import type { ContentWorkspaceChromeProps } from "./ContentWorkspaceChrome";
import type { RefObject } from "react";

export type TriPaneChromeFrameSlice = {
  page: ContentPage | null;
  isContentTab: boolean;
  hideLegacyNav: boolean;
  editorCanvasRef: RefObject<HTMLElement | null>;
  rightRailSlots: ContentWorkspaceChromeProps["rightRailSlots"];
};

/** @deprecated Bruk `ChromeShellShared` direkte (FASE 27). */
export type TriPaneChromeSharedSlice = Parameters<typeof chromeShellShared>;
/** @deprecated Bruk `ChromeShellEditorOnly` direkte (FASE 27). */
export type TriPaneChromeEditorSlice = Parameters<typeof chromeShellEditor>;
/** @deprecated Bruk `ChromeShellMainOnly` direkte som `main`-slice (FASE 26B). */
export type TriPaneChromeMainSlice = Parameters<typeof chromeShellMain>;
export type TriPaneChromePropertiesSlice = Parameters<typeof chromeShellProperties>;
export type TriPaneChromeTriSlice = Parameters<typeof chromeShellTri>;

/** Pass-through til `chromeShellShared` — én linje i parent. */
export function buildChromeShellSharedSliceFromFields(
  ...args: Parameters<typeof chromeShellShared>
): ChromeShellShared {
  return chromeShellShared(...args);
}

/** Pass-through til `chromeShellEditor` — én linje i parent. */
export function buildChromeShellEditorSliceFromFields(
  ...args: Parameters<typeof chromeShellEditor>
): ChromeShellEditorOnly {
  return chromeShellEditor(...args);
}

/** Pass-through til `chromeShellProperties` — én linje i parent. */
export function buildChromeShellPropertiesSliceFromFields(
  ...args: Parameters<typeof chromeShellProperties>
): ChromeShellProperties {
  return chromeShellProperties(...args);
}

/** Pass-through til `chromeShellTri` — én linje i parent. */
export function buildChromeShellTriSliceFromFields(
  ...args: Parameters<typeof chromeShellTri>
): ChromeShellTri {
  return chromeShellTri(...args);
}

/** Pass-through til `chromeShellMain` — én linje i parent (FASE 27). */
export function buildChromeShellMainOnlyFromFields(
  ...args: Parameters<typeof chromeShellMain>
): ChromeShellMainOnly {
  return chromeShellMain(...args);
}

/**
 * `shared` / `editor` / `properties` / `tri` er samme objekter som `chromeShell*` returnerer (FASE 27).
 * `main` er `ChromeShellMainOnly`.
 */
export function buildContentWorkspaceTriPaneMountChromeWireFromWorkspaceSlices(s: {
  frame: TriPaneChromeFrameSlice;
  shared: ChromeShellShared;
  editor: ChromeShellEditorOnly;
  main: ChromeShellMainOnly;
  properties: ChromeShellProperties;
  tri: ChromeShellTri;
}): ChromeShellWireInput {
  return buildContentWorkspaceTriPaneMountChromeWire(
    chromeShellFrame(
      s.frame.page,
      s.frame.isContentTab,
      s.frame.hideLegacyNav,
      s.frame.editorCanvasRef,
      s.frame.rightRailSlots
    ),
    s.shared,
    s.editor,
    s.main,
    s.properties,
    s.tri
  );
}
