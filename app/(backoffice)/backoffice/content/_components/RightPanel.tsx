"use client";

import type { ReactNode } from "react";
import {
  useBellissimaWorkspaceModel,
  useBellissimaWorkspaceShellState,
} from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import { BackofficeWorkspaceViewTabs } from "@/components/backoffice/BackofficeWorkspaceViewTabs";
import type { ContentBellissimaWorkspaceSideAppId } from "@/lib/cms/backofficeWorkspaceContextModel";

export function RightPanel(props: {
  workspaceSlot: ReactNode;
  aiSlot: React.ReactNode;
  diagnoseSlot: React.ReactNode;
  ceoSlot: React.ReactNode;
}) {
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
  const inspectorSections = model?.inspectorSections ?? [];

  return (
    <aside className="flex min-h-0 flex-col border-t border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/22 lg:border-t-0 lg:border-l">
      <div className="sticky top-0 z-10 border-b border-[rgb(var(--lp-border))] bg-white/96 px-3 py-3 backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Inspector</p>
        <p className="mt-1 text-xs leading-relaxed text-[rgb(var(--lp-muted))]">
          Arbeidsflate, AI og runtime leser fra samme Bellissima-kontekst. Høyre rail bytter app uten å miste aktiv side
          eller workspace-visning.
        </p>
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-medium text-[rgb(var(--lp-muted))]">
          {inspectorSections.map((section) => (
            <span
              key={section.id}
              className={`rounded-full border px-2 py-1 ${
                section.active
                  ? "border-slate-300 bg-white text-[rgb(var(--lp-text))]"
                  : "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/55"
              }`}
            >
              {section.label}
            </span>
          ))}
        </div>
        <div className="mt-3">
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
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
        {activeSideApp === "workspace" ? <div className="space-y-4">{props.workspaceSlot}</div> : null}
        {activeSideApp === "ai" ? (
          <div className="space-y-4">
            <section className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                Kanonisk editor-AI
              </p>
              {props.aiSlot}
            </section>
          </div>
        ) : null}
        {activeSideApp === "runtime" ? (
          <div className="space-y-3">
            <section className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Historikk og runtime</p>
              <p className="text-xs leading-relaxed text-[rgb(var(--lp-muted))]">
                Degradert audit, runtime-signaler og historikkstatus samles her i én operatørflate, ikke som spredte varsler
                i hele editoren.
              </p>
            </section>
            {props.diagnoseSlot}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
