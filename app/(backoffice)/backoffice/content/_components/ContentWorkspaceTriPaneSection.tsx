"use client";

/**
 * Tri-pane layout for content tab: LeftSidebar · EditorCanvas/MainCanvas · RightPanel.
 * Extracted from ContentWorkspaceChrome; composition and props unchanged.
 */

import type { RefObject, ReactNode } from "react";
import { getBlockLabel } from "./_stubs";
import { getBlockTreeLabel } from "./blockLabels";
import { ContentAiContextPanel } from "./ContentAiContextPanel";
import {
  ContentWorkspaceMainCanvas,
  type ContentWorkspaceMainCanvasProps,
} from "./ContentWorkspaceMainCanvas";
import { WorkspaceInspector, type WorkspaceInspectorProps } from "./WorkspaceInspector";
import { ContentWorkspaceWorkspaceShell } from "./ContentWorkspaceWorkspaceShell";
import { EditorCanvas } from "./EditorCanvas";
import { EditorStructureTree } from "./EditorStructureTree";
import { LeftSidebar } from "./LeftSidebar";
import { RightPanel } from "./RightPanel";
import type { ContentWorkspaceChromeTriPaneLeftProps } from "./contentWorkspace.chromeSection.types";

export type ContentWorkspaceTriPaneSectionProps = {
  canvasMode: "preview" | "edit";
  hideLegacyNav: boolean;
  editorCanvasRef: RefObject<HTMLElement | null>;
  mainCanvas: ContentWorkspaceMainCanvasProps;
  propertiesRail: WorkspaceInspectorProps;
  rightRailSlots: {
    aiSlot: ReactNode;
    diagnoseSlot: ReactNode;
    ceoSlot: ReactNode;
  };
  triPaneLeft: ContentWorkspaceChromeTriPaneLeftProps;
};

export function ContentWorkspaceTriPaneSection(props: ContentWorkspaceTriPaneSectionProps) {
  const {
    canvasMode,
    hideLegacyNav,
    editorCanvasRef,
    mainCanvas,
    propertiesRail,
    rightRailSlots,
    triPaneLeft,
  } = props;

  const {
    selectedId,
    selectedBlockId,
    onSelectBlockFromTree,
    hoverBlockId,
    setHoverBlockId,
    displayBlocks,
    showBlocks,
    title,
    page,
    slug,
    effectiveId,
    aiCapability,
    aiSummary,
    aiError,
  } = triPaneLeft;

  return (
    <ContentWorkspaceWorkspaceShell
      canvasMode={canvasMode}
      leftColumn={
        <LeftSidebar
          hideLegacyNav={hideLegacyNav}
          legacyNavSlot={
            <p className="px-1 text-xs text-[rgb(var(--lp-muted))]">
              Bruk navigasjonen i kolonnen helt til venstre for å velge side.
            </p>
          }
          structureSlot={
            showBlocks ? (
              <EditorStructureTree
                nodeId={selectedId}
                selectedBlockId={selectedBlockId}
                onSelectBlock={onSelectBlockFromTree}
                hoverBlockId={hoverBlockId}
                onHoverBlock={setHoverBlockId}
                pageTitle={(page?.title ?? title).trim() || "—"}
                blocks={displayBlocks}
              />
            ) : (
              <p className="px-1 text-xs text-[rgb(var(--lp-muted))]">Ingen blokker på denne siden.</p>
            )
          }
          aiContextSlot={
            <ContentAiContextPanel
              aiCapability={aiCapability}
              pageId={effectiveId}
              pageTitle={(page?.title ?? title).trim() || "—"}
              pageSlug={(slug ?? page?.slug ?? "").toString()}
              selectedBlockId={selectedBlockId}
              focusedBlockLabel={
                selectedBlockId
                  ? (() => {
                      const idx = displayBlocks.findIndex((b) => b.id === selectedBlockId);
                      const bl = idx >= 0 ? displayBlocks[idx] : null;
                      return bl ? `${idx + 1}. ${getBlockLabel(bl.type)}` : null;
                    })()
                  : null
              }
              neighborContext={
                selectedBlockId
                  ? (() => {
                      const idx = displayBlocks.findIndex((b) => b.id === selectedBlockId);
                      if (idx < 0) return null;
                      return {
                        prev: idx > 0 ? getBlockTreeLabel(displayBlocks[idx - 1]!) : null,
                        next:
                          idx < displayBlocks.length - 1 ? getBlockTreeLabel(displayBlocks[idx + 1]!) : null,
                      };
                    })()
                  : null
              }
              aiSummary={aiSummary}
              aiError={aiError}
            />
          }
        />
      }
      centerColumn={
        <EditorCanvas ref={editorCanvasRef}>
          <ContentWorkspaceMainCanvas {...mainCanvas} />
        </EditorCanvas>
      }
      rightColumn={
        <RightPanel
          workspaceSlot={<WorkspaceInspector {...propertiesRail} />}
          aiSlot={rightRailSlots.aiSlot}
          diagnoseSlot={rightRailSlots.diagnoseSlot}
          ceoSlot={rightRailSlots.ceoSlot}
        />
      }
    />
  );
}
