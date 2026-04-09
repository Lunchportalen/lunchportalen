"use client";

import type { Dispatch, SetStateAction } from "react";
import { ContentWorkspaceGlobalFooterShell } from "./ContentWorkspaceGlobalFooterShell";
import { ContentWorkspaceGlobalHeaderShell, type HeaderVariantId } from "./ContentWorkspaceGlobalHeaderShell";
import {
  ContentWorkspaceGlobalNavigationShell,
  type ContentWorkspaceNavigationTabKey,
} from "./ContentWorkspaceGlobalNavigationShell";
import { ContentWorkspaceGlobalReusableShell } from "./ContentWorkspaceGlobalReusableShell";
import { ContentWorkspaceGlobalRootShell } from "./ContentWorkspaceGlobalRootShell";
import type { GlobalPanelTab, GlobalSubView } from "./useContentWorkspaceShell";

export type ContentWorkspaceGlobalGlobalBranchShellProps = {
  globalSubView: GlobalSubView;
  exitGlobalSubView: () => void;
  globalPanelTab: GlobalPanelTab;
  setGlobalPanelTab: Dispatch<SetStateAction<GlobalPanelTab>>;
  openGlobalSubViewCard: (cardId: string | null) => void;
  headerVariant: HeaderVariantId | null;
  setHeaderVariant: Dispatch<SetStateAction<HeaderVariantId | null>>;
  headerEditConfig: {
    title: string;
    nav: Array<{ label: string; href: string; exact?: boolean }>;
  } | null;
  setHeaderEditConfig: Dispatch<
    SetStateAction<{ title: string; nav: Array<{ label: string; href: string; exact?: boolean }> } | null>
  >;
  headerEditLoading: boolean;
  setHeaderEditLoading: Dispatch<SetStateAction<boolean>>;
  headerEditError: string | null;
  setHeaderEditError: Dispatch<SetStateAction<string | null>>;
  headerEditSaving: boolean;
  setHeaderEditSaving: Dispatch<SetStateAction<boolean>>;
  footerTab: "content" | "advanced";
  setFooterTab: Dispatch<SetStateAction<"content" | "advanced">>;
  navigationTab: ContentWorkspaceNavigationTabKey;
  setNavigationTab: Dispatch<SetStateAction<ContentWorkspaceNavigationTabKey>>;
  hideMainNavigation: boolean;
  setHideMainNavigation: Dispatch<SetStateAction<boolean>>;
  hideSecondaryNavigation: boolean;
  setHideSecondaryNavigation: Dispatch<SetStateAction<boolean>>;
  hideFooterNavigation: boolean;
  setHideFooterNavigation: Dispatch<SetStateAction<boolean>>;
  hideMemberNavigation: boolean;
  setHideMemberNavigation: Dispatch<SetStateAction<boolean>>;
  hideCtaNavigation: boolean;
  setHideCtaNavigation: Dispatch<SetStateAction<boolean>>;
  hideLanguageNavigation: boolean;
  setHideLanguageNavigation: Dispatch<SetStateAction<boolean>>;
  multilingualMode: "multiSite" | "oneToOne";
  setMultilingualMode: Dispatch<SetStateAction<"multiSite" | "oneToOne">>;
};

/**
 * Global workspace: alle mainView-global-grener unntatt «Innhold og innstillinger» (eget shell).
 * Én komponerende inngang fra `ContentWorkspace.tsx`; ingen ny forretningslogikk.
 */
export function ContentWorkspaceGlobalGlobalBranchShell(props: ContentWorkspaceGlobalGlobalBranchShellProps) {
  const { globalSubView } = props;
  if (globalSubView === "content-and-settings") return null;
  if (globalSubView === "reusable-components") {
    return <ContentWorkspaceGlobalReusableShell exitGlobalSubView={props.exitGlobalSubView} />;
  }
  if (globalSubView === "header") {
    return (
      <ContentWorkspaceGlobalHeaderShell
        exitGlobalSubView={props.exitGlobalSubView}
        headerVariant={props.headerVariant}
        setHeaderVariant={props.setHeaderVariant}
        headerEditConfig={props.headerEditConfig}
        setHeaderEditConfig={props.setHeaderEditConfig}
        headerEditLoading={props.headerEditLoading}
        setHeaderEditLoading={props.setHeaderEditLoading}
        headerEditError={props.headerEditError}
        setHeaderEditError={props.setHeaderEditError}
        headerEditSaving={props.headerEditSaving}
        setHeaderEditSaving={props.setHeaderEditSaving}
      />
    );
  }
  if (globalSubView === "footer") {
    return (
      <ContentWorkspaceGlobalFooterShell
        exitGlobalSubView={props.exitGlobalSubView}
        footerTab={props.footerTab}
        setFooterTab={props.setFooterTab}
      />
    );
  }
  if (globalSubView === "navigation") {
    return (
      <ContentWorkspaceGlobalNavigationShell
        exitGlobalSubView={props.exitGlobalSubView}
        navigationTab={props.navigationTab}
        setNavigationTab={props.setNavigationTab}
        hideMainNavigation={props.hideMainNavigation}
        setHideMainNavigation={props.setHideMainNavigation}
        hideSecondaryNavigation={props.hideSecondaryNavigation}
        setHideSecondaryNavigation={props.setHideSecondaryNavigation}
        hideFooterNavigation={props.hideFooterNavigation}
        setHideFooterNavigation={props.setHideFooterNavigation}
        hideMemberNavigation={props.hideMemberNavigation}
        setHideMemberNavigation={props.setHideMemberNavigation}
        hideCtaNavigation={props.hideCtaNavigation}
        setHideCtaNavigation={props.setHideCtaNavigation}
        hideLanguageNavigation={props.hideLanguageNavigation}
        setHideLanguageNavigation={props.setHideLanguageNavigation}
        multilingualMode={props.multilingualMode}
        setMultilingualMode={props.setMultilingualMode}
      />
    );
  }
  if (globalSubView === null) {
    return (
      <ContentWorkspaceGlobalRootShell
        globalPanelTab={props.globalPanelTab}
        setGlobalPanelTab={props.setGlobalPanelTab}
        openGlobalSubViewCard={props.openGlobalSubViewCard}
      />
    );
  }
  return null;
}
