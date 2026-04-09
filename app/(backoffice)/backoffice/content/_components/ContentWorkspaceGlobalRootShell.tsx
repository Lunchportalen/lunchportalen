"use client";

import type { Dispatch, SetStateAction } from "react";
import * as ShellUi from "./contentWorkspaceShellUiConstants";
import { ContentWorkspaceGlobalPanelTabPlaceholder } from "./contentWorkspaceShellMountFragments";
import type { GlobalPanelTab } from "./useContentWorkspaceShell";

export type ContentWorkspaceGlobalRootShellProps = {
  globalPanelTab: GlobalPanelTab;
  setGlobalPanelTab: Dispatch<SetStateAction<GlobalPanelTab>>;
  openGlobalSubViewCard: (cardId: string | null) => void;
};

/**
 * Global workspace rot (ingen drill-down): faner og oversiktskort.
 * Props-only presentasjon; navigasjon eies i `ContentWorkspace.tsx` / shell-hook.
 */
export function ContentWorkspaceGlobalRootShell({
  globalPanelTab,
  setGlobalPanelTab,
  openGlobalSubViewCard,
}: ContentWorkspaceGlobalRootShellProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Global</h1>
      <div className="flex gap-1 border-b border-[rgb(var(--lp-border))] pb-2">
        {(["global", "content", "info"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setGlobalPanelTab(tab)}
            className={`min-h-9 rounded-t-lg border px-4 text-sm font-medium ${globalPanelTab === tab
              ? "border-[rgb(var(--lp-border))] border-b-0 bg-white text-[rgb(var(--lp-text))] -mb-px"
              : "border-transparent text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
              }`}
          >
            {tab === "global" ? "Global" : tab === "content" ? "Content" : "Info"}
          </button>
        ))}
      </div>
      {globalPanelTab === "global" ? (
        <div className="space-y-4">
          <p className="text-sm text-[rgb(var(--lp-muted))]">
            Administrer globalt innhold og innstillinger for nettstedet.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ShellUi.GLOBAL_WORKSPACE_PANEL_CARDS.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => openGlobalSubViewCard(card.id)}
                className="flex w-full items-start gap-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                title={card.id ? undefined : "Kommer snart"}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-lg text-slate-600">
                  {card.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[rgb(var(--lp-text))]">{card.title}</p>
                  <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">{card.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : globalPanelTab === "content" ? (
        <ContentWorkspaceGlobalPanelTabPlaceholder tab="content" />
      ) : (
        <ContentWorkspaceGlobalPanelTabPlaceholder tab="info" />
      )}
    </div>
  );
}
