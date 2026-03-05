"use client";

import type { ReactNode } from "react";
import { panelBorder, panelBg } from "./panelHeaderClasses";

type SectionShellProps = {
  treeSlot: ReactNode;
  children: ReactNode;
};

/**
 * Umbraco-style section: 280px tree | 1fr workspace (64px rail is in BackofficeShell).
 * Borders and separate scroll areas.
 */
export default function SectionShell({ treeSlot, children }: SectionShellProps) {
  return (
    <div className="grid h-full min-h-0 flex-1" style={{ gridTemplateColumns: "280px 1fr" }}>
      <aside
        className={`flex h-full min-h-0 flex-col overflow-y-auto ${panelBorder} ${panelBg}`}
        style={{ width: "280px" }}
      >
        {treeSlot}
      </aside>
      <main className="min-h-0 min-w-0 overflow-y-auto bg-slate-50/80">
        {children}
      </main>
    </div>
  );
}
