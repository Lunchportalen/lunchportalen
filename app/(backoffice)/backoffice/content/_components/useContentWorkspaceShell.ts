/**
 * Global workspace shell: main view (page / global / design), global panel tabs,
 * global sub-views (content settings, header, …), and navigation helpers.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useBellissimaEntityWorkspaceViewState } from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import type { BackofficeContentEntityWorkspaceViewId } from "@/lib/cms/backofficeExtensionRegistry";

export type MainWorkspaceView = BackofficeContentEntityWorkspaceViewId;
export type MainView = BackofficeContentEntityWorkspaceViewId;

export type GlobalPanelTab = "global" | "content" | "info";

export type GlobalSubView =
  | null
  | "content-and-settings"
  | "header"
  | "navigation"
  | "footer"
  | "reusable-components";

export function useContentWorkspaceShell() {
  const { activeView: mainView, setActiveView: setMainView } =
    useBellissimaEntityWorkspaceViewState();
  const [globalPanelTab, setGlobalPanelTab] = useState<GlobalPanelTab>("global");
  const [globalSubView, setGlobalSubView] = useState<GlobalSubView>(null);

  /** Leaving Global clears nested sub-view so Design/Page never inherit stale global drill-down. */
  useEffect(() => {
    if (mainView !== "global") {
      setGlobalSubView(null);
    }
  }, [mainView]);

  const goToPageView = useCallback(() => setMainView("content"), [setMainView]);
  const goToPreviewWorkspace = useCallback(() => setMainView("preview"), [setMainView]);
  const goToHistoryWorkspace = useCallback(() => setMainView("history"), [setMainView]);
  const goToGlobalWorkspace = useCallback(() => setMainView("global"), [setMainView]);
  const goToDesignWorkspace = useCallback(() => setMainView("design"), [setMainView]);

  const openGlobalSubViewCard = useCallback((cardId: string | null) => {
    if (!cardId) return;
    const map: Record<string, GlobalSubView> = {
      "content-and-settings": "content-and-settings",
      header: "header",
      navigation: "navigation",
      footer: "footer",
      "reusable-components": "reusable-components",
    };
    const next = map[cardId];
    if (next) setGlobalSubView(next);
  }, []);

  const exitGlobalSubView = useCallback(() => setGlobalSubView(null), []);

  return {
    mainView,
    setMainView,
    globalPanelTab,
    setGlobalPanelTab,
    globalSubView,
    setGlobalSubView,
    goToPageView,
    goToPreviewWorkspace,
    goToHistoryWorkspace,
    goToGlobalWorkspace,
    goToDesignWorkspace,
    openGlobalSubViewCard,
    exitGlobalSubView,
  };
}
