"use client";

/**
 * Workspace chrome: editor topbar/save row + tri-pane (LeftSidebar · EditorCanvas/MainCanvas · RightPanel).
 * Composition only — same preview pipeline props as before; parent owns hooks/state.
 */

import type { RefObject, ReactNode } from "react";
import {
  ContentWorkspaceEditorChrome,
  type ContentWorkspaceEditorChromeProps,
} from "./ContentWorkspaceEditorChrome";
import {
  ContentWorkspaceMainCanvas,
  type ContentWorkspaceMainCanvasProps,
} from "./ContentWorkspaceMainCanvas";
import { ContentWorkspacePropertiesRail, type ContentWorkspacePropertiesRailProps } from "./ContentWorkspacePropertiesRail";
import { ContentWorkspaceTriPaneSection } from "./ContentWorkspaceTriPaneSection";
import type { ContentWorkspaceChromeTriPaneLeftProps } from "./contentWorkspace.chromeSection.types";

export type { ContentWorkspaceChromeTriPaneLeftProps } from "./contentWorkspace.chromeSection.types";

export type ContentWorkspaceChromeProps = {
  editorChrome: ContentWorkspaceEditorChromeProps;
  isContentTab: boolean;
  canvasMode: "preview" | "edit";
  hideLegacyNav: boolean;
  editorCanvasRef: RefObject<HTMLElement | null>;
  mainCanvas: ContentWorkspaceMainCanvasProps;
  propertiesRail: ContentWorkspacePropertiesRailProps;
  rightRailSlots: {
    aiSlot: ReactNode;
    diagnoseSlot: ReactNode;
    ceoSlot: ReactNode;
  };
  triPaneLeft: ContentWorkspaceChromeTriPaneLeftProps;
};

export function ContentWorkspaceChrome(props: ContentWorkspaceChromeProps) {
  const {
    editorChrome,
    isContentTab,
    canvasMode,
    hideLegacyNav,
    editorCanvasRef,
    mainCanvas,
    propertiesRail,
    rightRailSlots,
    triPaneLeft,
  } = props;

  return (
    <div className="mt-2 w-full min-w-0 space-y-3">
      <ContentWorkspaceEditorChrome {...editorChrome} />

      {isContentTab ? (
        <ContentWorkspaceTriPaneSection
          canvasMode={canvasMode}
          hideLegacyNav={hideLegacyNav}
          editorCanvasRef={editorCanvasRef}
          mainCanvas={mainCanvas}
          propertiesRail={propertiesRail}
          rightRailSlots={rightRailSlots}
          triPaneLeft={triPaneLeft}
        />
      ) : null}
    </div>
  );
}
