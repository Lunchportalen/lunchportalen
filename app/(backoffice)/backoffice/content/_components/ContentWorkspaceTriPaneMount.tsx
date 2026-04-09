"use client";

import { ContentWorkspaceAuxiliaryShell } from "./ContentWorkspaceAuxiliaryShell";
import { ContentWorkspaceChrome } from "./ContentWorkspaceChrome";
import { buildContentWorkspaceAuxiliaryShellProps } from "./contentWorkspaceAuxiliaryShellProps";
import { buildWorkspaceAuxiliaryShellArgs, buildWorkspaceChromeShellPropsFromWire } from "./contentWorkspaceShellInputContexts";
import type { ContentWorkspaceTriPaneMountProps } from "./contentWorkspaceTriPaneMountProps";

/** Tri-pane chrome + auxiliary mount — ren builder→skall; ingen domene-/preview-logikk. */
export function ContentWorkspaceTriPaneMount(props: ContentWorkspaceTriPaneMountProps) {
  const { chromeWire, auxiliaryWire } = props;
  return (
    <>
      <ContentWorkspaceChrome {...buildWorkspaceChromeShellPropsFromWire(chromeWire)} />
      <ContentWorkspaceAuxiliaryShell
        {...buildContentWorkspaceAuxiliaryShellProps(buildWorkspaceAuxiliaryShellArgs(auxiliaryWire))}
      />
    </>
  );
}
