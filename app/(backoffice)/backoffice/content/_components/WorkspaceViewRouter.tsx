"use client";

import { ContentWorkspaceDesignTailShell } from "./ContentWorkspaceDesignTailShell";
import { ContentWorkspaceGlobalGlobalBranchShell } from "./ContentWorkspaceGlobalGlobalBranchShell";
import { ContentWorkspaceGlobalMainViewShell } from "./ContentWorkspaceGlobalMainViewShell";
import { ContentWorkspaceGlobalMainViewShellCont } from "./ContentWorkspaceGlobalMainViewShellCont";
import { ContentWorkspaceHistoryView } from "./ContentWorkspaceHistoryView";
import {
  type ContentWorkspaceShellModel,
} from "./useContentWorkspaceShellModel";

export type WorkspaceViewRouterProps = {
  activeWorkspaceView: ContentWorkspaceShellModel["activeWorkspaceView"];
} & ContentWorkspaceShellModel["pageEditorShellProps"];

export function WorkspaceViewRouter({
  activeWorkspaceView,
  ...pageEditorShellProps
}: WorkspaceViewRouterProps) {
  if (activeWorkspaceView === "content" || activeWorkspaceView === "preview") {
    return null;
  }

  if (activeWorkspaceView === "design") {
    return <ContentWorkspaceDesignTailShell {...pageEditorShellProps.designTail} />;
  }

  if (
    activeWorkspaceView === "global" &&
    pageEditorShellProps.globalSubView === "content-and-settings"
  ) {
    return (
      <div className="space-y-6">
        <ContentWorkspaceGlobalMainViewShell {...pageEditorShellProps.globalMainView} />
        <ContentWorkspaceGlobalMainViewShellCont
          {...pageEditorShellProps.globalMainViewCont}
        />
      </div>
    );
  }

  if (activeWorkspaceView === "global") {
    return (
      <ContentWorkspaceGlobalGlobalBranchShell
        {...pageEditorShellProps.globalBranchProps}
      />
    );
  }

  if (activeWorkspaceView === "history") {
    return <ContentWorkspaceHistoryView {...pageEditorShellProps.historyView} />;
  }

  return null;
}
