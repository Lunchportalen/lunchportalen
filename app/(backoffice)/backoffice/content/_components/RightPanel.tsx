"use client";

/** Kanonisk editor-AI / høyre panel: workspace + AI + runtime; ingen duplisert CEO-rad i panelet. */
import type { ReactNode } from "react";
import {
  useBellissimaWorkspaceModel,
  useBellissimaWorkspaceShellState,
} from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import { BackofficeWorkspaceViewTabs } from "@/components/backoffice/BackofficeWorkspaceViewTabs";
import type { ContentBellissimaWorkspaceSideAppId } from "@/lib/cms/backofficeWorkspaceContextModel";

function RightPanelInspectorOnly({ workspaceSlot }: { workspaceSlot: ReactNode }) {
  return (
    <aside
      className="flex h-full min-h-0 min-w-0 flex-col border-t border-slate-300/70 bg-[#f1f3f6] lg:border-t-0 lg:border-l lg:border-slate-300/75"
      data-lp-right-panel="inspector-only"
      data-lp-right-panel-detail-rail="integrated"
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{workspaceSlot}</div>
      </div>
    </aside>
  );
}

type RightPanelTabsProps = {
  workspaceSlot: ReactNode;
  aiSlot: React.ReactNode;
  diagnoseSlot: React.ReactNode;
};

function RightPanelWithTabs(props: RightPanelTabsProps) {
  const model = useBellissimaWorkspaceModel();
  const { activeSideApp, setActiveSideApp } = useBellissimaWorkspaceShellState();
  const fallbackTabs: {
    id: ContentBellissimaWorkspaceSideAppId;
    label: string;
    description: string;
    active: boolean;
  }[] = [
    { id: "workspace", label: "Arbeidsflate", description: "Inspector og egenskaper.", active: true },
    { id: "ai", label: "AI", description: "AI-verktøy for siden.", active: false },
    { id: "runtime", label: "Runtime", description: "Historikk og driftssignaler.", active: false },
  ];
  const tabs =
    model?.sideApps?.length ? model.sideApps : fallbackTabs;

  return (
    <aside className="flex min-h-0 flex-col border-t border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/22 lg:border-t-0 lg:border-l">
      <div className="sticky top-0 z-10 border-b border-[rgb(var(--lp-border))]/80 bg-[rgb(var(--lp-card))]/40 px-2 py-2 backdrop-blur-sm">
        <BackofficeWorkspaceViewTabs
          items={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            description: tab.description,
            active: tab.active ?? activeSideApp === tab.id,
            onClick: () => setActiveSideApp(tab.id),
          }))}
          ariaLabel="Høyre arbeidsflater"
          surface="subtle"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-3">
        {activeSideApp === "workspace" ? <div className="space-y-4">{props.workspaceSlot}</div> : null}
        {activeSideApp === "ai" ? <div className="space-y-4">{props.aiSlot}</div> : null}
        {activeSideApp === "runtime" ? (
          <div className="space-y-3">{props.diagnoseSlot}</div>
        ) : null}
      </div>
    </aside>
  );
}

export function RightPanel(props: {
  workspaceSlot: ReactNode;
  aiSlot: React.ReactNode;
  diagnoseSlot: React.ReactNode;
  ceoSlot: React.ReactNode;
  /** På dokument-detail: kun sekundær inspector — ingen AI/Runtime-fane-rad. */
  hideSideAppTabs?: boolean;
}) {
  if (props.hideSideAppTabs) {
    return <RightPanelInspectorOnly workspaceSlot={props.workspaceSlot} />;
  }

  return (
    <RightPanelWithTabs
      workspaceSlot={props.workspaceSlot}
      aiSlot={props.aiSlot}
      diagnoseSlot={props.diagnoseSlot}
    />
  );
}
