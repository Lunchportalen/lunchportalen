"use client";

import { useState, type ReactNode } from "react";

export type WorkspaceLeftTab = "content" | "structure" | "ai";

export function LeftSidebar(props: {
  hideLegacyNav: boolean;
  /** Content tab when full workspace (non-embedded). */
  legacyNavSlot: React.ReactNode;
  structureSlot: React.ReactNode;
  aiContextSlot: React.ReactNode;
}) {
  const [tab, setTab] = useState<WorkspaceLeftTab>(props.hideLegacyNav ? "structure" : "content");

  const tabs: { id: WorkspaceLeftTab; label: string }[] = props.hideLegacyNav
    ? [
        { id: "structure", label: "Blokker" },
        { id: "ai", label: "AI" },
      ]
    : [
        { id: "content", label: "Side" },
        { id: "structure", label: "Blokker" },
        { id: "ai", label: "AI" },
      ];

  return (
    <aside className="flex min-h-0 flex-col border-b border-[rgb(var(--lp-border))]/70 bg-[rgb(var(--lp-card))]/25 lg:border-b-0 lg:border-r lg:border-[rgb(var(--lp-border))]/60">
      <div className="sticky top-0 z-10 border-b border-[rgb(var(--lp-border))]/55 bg-[rgb(var(--lp-bg))]/55 px-2 py-1.5 backdrop-blur-[6px]">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-8 rounded-md px-2 text-[11px] font-medium transition-colors ${
                tab === t.id
                  ? "bg-white/95 text-[rgb(var(--lp-text))] shadow-sm ring-1 ring-[rgb(var(--lp-border))]/80"
                  : "text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-2.5">
        {!props.hideLegacyNav && tab === "content" ? props.legacyNavSlot : null}
        {tab === "structure" ? props.structureSlot : null}
        {tab === "ai" ? props.aiContextSlot : null}
      </div>
    </aside>
  );
}
