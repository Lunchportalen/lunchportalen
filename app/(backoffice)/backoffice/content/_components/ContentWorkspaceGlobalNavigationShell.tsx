"use client";

import type { Dispatch, SetStateAction } from "react";
import * as ShellUi from "./contentWorkspaceShellUiConstants";
import { ContentWorkspaceGlobalNavigationShellPanelsCont } from "./ContentWorkspaceGlobalNavigationShellPanelsCont";
import { ContentWorkspaceGlobalNavigationShellPanelsLead } from "./ContentWorkspaceGlobalNavigationShellPanelsLead";

export type ContentWorkspaceNavigationTabKey =
  "main" | "secondary" | "footer" | "member" | "cta" | "language" | "advanced";

export type ContentWorkspaceGlobalNavigationShellProps = {
  exitGlobalSubView: () => void;
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

/** Global workspace » Navigation: faner, paneler og lagre-linje. Props-only presentasjon. */
export function ContentWorkspaceGlobalNavigationShell(props: ContentWorkspaceGlobalNavigationShellProps) {
  const {
    exitGlobalSubView,
    navigationTab,
    setNavigationTab,
    hideMainNavigation,
    setHideMainNavigation,
    hideSecondaryNavigation,
    setHideSecondaryNavigation,
    hideFooterNavigation,
    setHideFooterNavigation,
    hideMemberNavigation,
    setHideMemberNavigation,
    hideCtaNavigation,
    setHideCtaNavigation,
    hideLanguageNavigation,
    setHideLanguageNavigation,
    multilingualMode,
    setMultilingualMode,
  } = props;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => exitGlobalSubView()}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Tilbake til Global"
        >
          –
        </button>
        <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Navigation</h1>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--lp-border))] pb-2">
        {ShellUi.NAVIGATION_SUB_TAB_TUPLES.map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setNavigationTab(tab)}
            className={`min-h-9 rounded-t-lg border px-3 text-sm font-medium ${navigationTab === tab
              ? "border-[rgb(var(--lp-border))] border-b-0 bg-white text-[rgb(var(--lp-text))] -mb-px"
              : "border-transparent text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {navigationTab === "main" || navigationTab === "secondary" || navigationTab === "footer" ? (
        <ContentWorkspaceGlobalNavigationShellPanelsLead
          navigationTab={navigationTab}
          hideMainNavigation={hideMainNavigation}
          setHideMainNavigation={setHideMainNavigation}
          hideSecondaryNavigation={hideSecondaryNavigation}
          setHideSecondaryNavigation={setHideSecondaryNavigation}
          hideFooterNavigation={hideFooterNavigation}
          setHideFooterNavigation={setHideFooterNavigation}
        />
      ) : (
        <ContentWorkspaceGlobalNavigationShellPanelsCont
          navigationTab={navigationTab}
          hideMemberNavigation={hideMemberNavigation}
          setHideMemberNavigation={setHideMemberNavigation}
          hideCtaNavigation={hideCtaNavigation}
          setHideCtaNavigation={setHideCtaNavigation}
          hideLanguageNavigation={hideLanguageNavigation}
          setHideLanguageNavigation={setHideLanguageNavigation}
          multilingualMode={multilingualMode}
          setMultilingualMode={setMultilingualMode}
        />
      )}

      <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
        <p className="text-xs text-[rgb(var(--lp-muted))]">Global / Navigation</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-green-700 hover:bg-slate-50"
          >
            Save
          </button>
          <button
            type="button"
            className="min-h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
          >
            Save and publish
          </button>
        </div>
      </div>
    </div>
  );
}
