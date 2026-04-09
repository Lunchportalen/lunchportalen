"use client";

import { ContentWorkspaceAuxiliaryShell } from "./ContentWorkspaceAuxiliaryShell";
import { ContentWorkspaceDesignTailShell } from "./ContentWorkspaceDesignTailShell";
import { ContentWorkspaceEditorChrome } from "./ContentWorkspaceEditorChrome";
import { ContentWorkspaceGlobalGlobalBranchShell } from "./ContentWorkspaceGlobalGlobalBranchShell";
import { ContentWorkspaceGlobalMainViewShell } from "./ContentWorkspaceGlobalMainViewShell";
import { ContentWorkspaceGlobalMainViewShellCont } from "./ContentWorkspaceGlobalMainViewShellCont";
import { ContentWorkspaceHistoryView } from "./ContentWorkspaceHistoryView";
import { ContentWorkspaceLegacySidebar } from "./ContentWorkspaceLegacySidebar";
import { ContentWorkspacePageEditorShell } from "./ContentWorkspacePageEditorShell";
import { ContentWorkspaceShellGlobalStyles } from "./ContentWorkspaceShellGlobalStyles";
import { ContentWorkspaceWorkspaceFrame } from "./ContentWorkspaceWorkspaceFrame";
import { EditorCanvas } from "./EditorCanvas";
import { LeftSidebar } from "./LeftSidebar";
import { RightPanel } from "./RightPanel";
import { WorkspaceBody } from "./WorkspaceBody";
import { WorkspaceFooter } from "./WorkspaceFooter";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceInspector } from "./WorkspaceInspector";
import { WorkspacePreview } from "./WorkspacePreview";
import { ContentWorkspaceModalShell } from "./contentWorkspaceModalShellInput";
import { ContentWorkspaceDevDebugOverlays } from "./contentWorkspaceShellMountFragments";
import {
  useContentWorkspaceShellModel,
  type ContentWorkspaceProps,
} from "./useContentWorkspaceShellModel";

export function ContentWorkspace(props: ContentWorkspaceProps) {
  const shellModel = useContentWorkspaceShellModel(props);

  return (
    <>
      <ContentWorkspaceDevDebugOverlays {...shellModel.debugOverlaysProps} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceHeader />
        <div className="min-h-0 flex-1 overflow-hidden">
          <ContentWorkspaceWorkspaceFrame
            hideLegacySidebar={shellModel.hideLegacySidebar}
            legacySidebar={<ContentWorkspaceLegacySidebar {...shellModel.legacySidebarProps} />}
          >
            {shellModel.activeWorkspaceView === "design" ? (
              <ContentWorkspaceDesignTailShell {...shellModel.pageEditorShellProps.designTail} />
            ) : shellModel.activeWorkspaceView === "global" &&
              shellModel.pageEditorShellProps.globalSubView === "content-and-settings" ? (
              <div className="space-y-6">
                <ContentWorkspaceGlobalMainViewShell
                  {...shellModel.pageEditorShellProps.globalMainView}
                />
                <ContentWorkspaceGlobalMainViewShellCont
                  {...shellModel.pageEditorShellProps.globalMainViewCont}
                />
              </div>
            ) : shellModel.activeWorkspaceView === "global" ? (
              <ContentWorkspaceGlobalGlobalBranchShell
                {...shellModel.pageEditorShellProps.globalBranchProps}
              />
            ) : shellModel.activeWorkspaceView === "history" ? (
              <ContentWorkspaceHistoryView {...shellModel.pageEditorShellProps.historyView} />
            ) : (
              <div className="w-full min-w-0 space-y-3">
                <ContentWorkspacePageEditorShell {...shellModel.pageEditorShellProps} />
                {shellModel.showCanonicalEditorSurfaces ? (
                  <>
                    <ContentWorkspaceEditorChrome {...shellModel.editorChromeProps} />
                    {shellModel.activeWorkspaceView === "preview" ? (
                      <div className="grid min-h-[min(84vh,1040px)] w-full min-w-0 grid-cols-1 overflow-clip rounded-2xl border border-[rgb(var(--lp-border))]/80 bg-white shadow-sm">
                        <div className="min-h-0 min-w-0 overflow-y-auto px-3 py-4 sm:px-5">
                          <WorkspacePreview {...shellModel.workspacePreviewProps} />
                        </div>
                      </div>
                    ) : (
                      <div
                        data-lp-content-workspace-shell="tri-pane"
                        className="grid min-h-[min(84vh,1040px)] w-full min-w-0 grid-cols-1 gap-0 overflow-clip rounded-2xl border border-[rgb(var(--lp-border))]/80 bg-white shadow-sm xl:grid-cols-[minmax(280px,320px)_minmax(0,1.42fr)_minmax(360px,min(36vw,460px))]"
                      >
                        <div className="min-h-0 min-w-0 overflow-clip">
                          <LeftSidebar {...shellModel.leftSidebarProps} />
                        </div>
                        <EditorCanvas ref={shellModel.editorCanvasRef}>
                          <WorkspaceBody {...shellModel.workspaceBodyProps} />
                        </EditorCanvas>
                        <div className="min-h-0 min-w-0 overflow-clip">
                          <RightPanel
                            workspaceSlot={
                              <WorkspaceInspector {...shellModel.workspaceInspectorProps} />
                            }
                            {...shellModel.rightPanelProps}
                          />
                        </div>
                      </div>
                    )}
                    <ContentWorkspaceAuxiliaryShell {...shellModel.auxiliaryShellProps} />
                  </>
                ) : null}
              </div>
            )}
          </ContentWorkspaceWorkspaceFrame>
        </div>
        <WorkspaceFooter />
      </div>
      <ContentWorkspaceModalShell {...shellModel.modalShellProps} />
      <ContentWorkspaceShellGlobalStyles />
    </>
  );
}
