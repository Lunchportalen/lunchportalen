"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
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
import { ContentDetailSecondaryInspector } from "./ContentDetailSecondaryInspector";
import { ContentDetailDocumentPrimaryBar } from "./ContentDetailDocumentShellBar";
import { ContentWorkspaceOutboxRecoveryBanner } from "./ContentWorkspaceOutboxRecoveryBanner";
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
  const pathname = usePathname() ?? "";
  const isContentDetailEditor = useMemo(
    () => resolveBackofficeContentRoute(pathname).kind === "detail",
    [pathname],
  );
  /** På `/backoffice/content/[id]`: dev-HUD av som standard; slå på med `?lpDebugHud=1` eller `localStorage lp-content-debug-hud=1`. */
  const [devHudOptIn, setDevHudOptIn] = useState(false);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const qOk = q.get("lpDebugHud") === "1";
      const lsOk = localStorage.getItem("lp-content-debug-hud") === "1";
      setDevHudOptIn(qOk || lsOk);
    } catch {
      setDevHudOptIn(false);
    }
  }, [pathname]);
  const debugOverlaysProps = {
    ...shellModel.debugOverlaysProps,
    isDev:
      shellModel.debugOverlaysProps.isDev &&
      (!isContentDetailEditor || devHudOptIn),
  };

  const ec = shellModel.editorChromeProps;
  const detailRecoveryBanner = (
    <ContentWorkspaceOutboxRecoveryBanner
      recoveryBannerVisible={ec.recoveryBannerVisible}
      outboxData={ec.outboxData}
      hasFingerprintConflict={ec.hasFingerprintConflict}
      outboxDetailsExpanded={ec.outboxDetailsExpanded}
      setOutboxDetailsExpanded={ec.setOutboxDetailsExpanded}
      copyOutboxSafetyExport={ec.copyOutboxSafetyExport}
      outboxCopyFeedback={ec.outboxCopyFeedback}
      onRestoreOutbox={ec.onRestoreOutbox}
      onDiscardOutbox={ec.onDiscardOutbox}
      formatDate={ec.formatDate}
    />
  );

  return (
    <>
      <ContentWorkspaceDevDebugOverlays {...debugOverlaysProps} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceHeader />
        <div className="min-h-0 flex-1 overflow-hidden">
          <ContentWorkspaceWorkspaceFrame
            hideLegacySidebar={shellModel.hideLegacySidebar}
            legacySidebar={<ContentWorkspaceLegacySidebar {...shellModel.legacySidebarProps} />}
            contentDetailUltraCompact={isContentDetailEditor}
          >
            {shellModel.activeWorkspaceView === "design" && !isContentDetailEditor ? (
              <ContentWorkspaceDesignTailShell {...shellModel.pageEditorShellProps.designTail} />
            ) : shellModel.activeWorkspaceView === "global" &&
              !isContentDetailEditor &&
              shellModel.pageEditorShellProps.globalSubView === "content-and-settings" ? (
              <div className="space-y-6">
                <ContentWorkspaceGlobalMainViewShell
                  {...shellModel.pageEditorShellProps.globalMainView}
                />
                <ContentWorkspaceGlobalMainViewShellCont
                  {...shellModel.pageEditorShellProps.globalMainViewCont}
                />
              </div>
            ) : shellModel.activeWorkspaceView === "global" && !isContentDetailEditor ? (
              <ContentWorkspaceGlobalGlobalBranchShell
                {...shellModel.pageEditorShellProps.globalBranchProps}
              />
            ) : shellModel.activeWorkspaceView === "history" ? (
              isContentDetailEditor ? (
                <div className="w-full min-w-0 space-y-0">
                  <ContentWorkspacePageEditorShell {...shellModel.pageEditorShellProps} />
                  {shellModel.showCanonicalEditorSurfaces ? (
                    <>
                      {detailRecoveryBanner}
                      <div className="max-h-[min(84vh,1040px)] min-h-0 overflow-y-auto">
                        <ContentWorkspaceHistoryView {...shellModel.pageEditorShellProps.historyView} />
                      </div>
                      <ContentDetailDocumentPrimaryBar />
                    </>
                  ) : (
                    <ContentWorkspaceHistoryView {...shellModel.pageEditorShellProps.historyView} />
                  )}
                </div>
              ) : (
                <ContentWorkspaceHistoryView {...shellModel.pageEditorShellProps.historyView} />
              )
            ) : (
              <div className={`w-full min-w-0 ${isContentDetailEditor ? "space-y-0" : "space-y-3"}`}>
                <ContentWorkspacePageEditorShell {...shellModel.pageEditorShellProps} />
                {shellModel.showCanonicalEditorSurfaces ? (
                  <>
                    {isContentDetailEditor ? (
                      shellModel.activeWorkspaceView === "preview" ? (
                        <>{detailRecoveryBanner}</>
                      ) : null
                    ) : (
                      <ContentWorkspaceEditorChrome {...shellModel.editorChromeProps} />
                    )}
                    {shellModel.activeWorkspaceView === "preview" && !isContentDetailEditor ? (
                      <>
                        <div className="grid min-h-[min(84vh,1040px)] w-full min-w-0 grid-cols-1 overflow-clip rounded-xl border border-[rgb(var(--lp-border))]/70 bg-white">
                          <div className="min-h-0 min-w-0 overflow-y-auto px-3 py-3 sm:px-4">
                            <WorkspacePreview {...shellModel.workspacePreviewProps} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div
                        data-lp-content-workspace-shell={
                          isContentDetailEditor ? "document-form" : "tri-pane"
                        }
                        className={
                          isContentDetailEditor
                            ? "grid min-h-[min(84vh,1040px)] w-full min-w-0 grid-cols-1 gap-0 overflow-clip border-0 bg-[rgb(var(--lp-bg))]/55 shadow-none xl:grid-cols-[minmax(0,1fr)_clamp(248px,25vw,300px)]"
                            : "grid min-h-[min(84vh,1040px)] w-full min-w-0 grid-cols-1 gap-0 overflow-clip rounded-xl border border-[rgb(var(--lp-border))]/70 bg-white xl:grid-cols-[minmax(280px,320px)_minmax(0,1.42fr)_minmax(360px,min(36vw,460px))]"
                        }
                      >
                        {!isContentDetailEditor ? (
                          <div className="min-h-0 min-w-0 overflow-clip">
                            <LeftSidebar {...shellModel.leftSidebarProps} />
                          </div>
                        ) : null}
                        {isContentDetailEditor ? (
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-0 border-[rgb(var(--lp-border))]/20 bg-[#eceef2] xl:border-r xl:border-[rgb(var(--lp-border))]/20">
                            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-white">
                              {detailRecoveryBanner}
                              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden [&>main]:min-h-0 [&>main]:min-w-0 [&>main]:flex-1">
                                <EditorCanvas
                                  ref={shellModel.editorCanvasRef}
                                  documentSurface={isContentDetailEditor}
                                >
                                  <WorkspaceBody
                                    {...shellModel.workspaceBodyProps}
                                    detailBlockInspectorCtx={
                                      shellModel.workspaceInspectorProps.blockInspectorCtx
                                    }
                                    detailWorkspaceInspectorProps={shellModel.workspaceInspectorProps}
                                  />
                                </EditorCanvas>
                              </div>
                              <ContentDetailDocumentPrimaryBar />
                            </div>
                          </div>
                        ) : (
                          <EditorCanvas ref={shellModel.editorCanvasRef} documentSurface={isContentDetailEditor}>
                            <WorkspaceBody
                              {...shellModel.workspaceBodyProps}
                              detailBlockInspectorCtx={undefined}
                              detailWorkspaceInspectorProps={undefined}
                            />
                          </EditorCanvas>
                        )}
                        <div className="min-h-0 min-w-0 overflow-clip">
                          <RightPanel
                            workspaceSlot={
                              isContentDetailEditor ? (
                                <ContentDetailSecondaryInspector {...shellModel.workspaceInspectorProps} />
                              ) : (
                                <WorkspaceInspector {...shellModel.workspaceInspectorProps} />
                              )
                            }
                            {...shellModel.rightPanelProps}
                            hideSideAppTabs={isContentDetailEditor}
                          />
                        </div>
                      </div>
                    )}
                    {!isContentDetailEditor ? (
                      <ContentWorkspaceAuxiliaryShell {...shellModel.auxiliaryShellProps} />
                    ) : null}
                  </>
                ) : null}
              </div>
            )}
          </ContentWorkspaceWorkspaceFrame>
        </div>
        {isContentDetailEditor ? null : <WorkspaceFooter />}
      </div>
      <ContentWorkspaceModalShell {...shellModel.modalShellProps} />
      <ContentWorkspaceShellGlobalStyles />
    </>
  );
}
