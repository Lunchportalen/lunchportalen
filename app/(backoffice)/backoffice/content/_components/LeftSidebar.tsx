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
    <aside className="flex min-h-0 flex-col border-b border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/35 lg:border-b-0 lg:border-r">
      <div className="sticky top-0 z-10 border-b border-[rgb(var(--lp-border))] bg-white/96 px-3 py-3 backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Sideinternt</p>
        <p className="mt-1 text-xs leading-relaxed text-[rgb(var(--lp-muted))]">
          Blokkstruktur og sidekontekst for aktiv side. Seksjonsnavigasjonen ligger i treet helt til venstre.
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
              className={`min-h-10 rounded-xl px-3 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-text))] shadow-sm ring-1 ring-[rgb(var(--lp-border))]"
                  : "text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!props.hideLegacyNav && tab === "content" ? props.legacyNavSlot : null}
        {tab === "structure" ? props.structureSlot : null}
        {tab === "ai" ? props.aiContextSlot : null}
      </div>
    </aside>
  );
}
