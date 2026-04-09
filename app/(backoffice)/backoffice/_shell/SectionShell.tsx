"use client";

import type { ReactNode } from "react";
import { cmsSectionTreeAsideClass, cmsWorkspaceMainSurfaceClass } from "@/lib/design/cmsShell";
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
    <div className="grid h-full min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(440px,min(40vw,680px))_minmax(0,1fr)]">
      <aside
        className={`${cmsSectionTreeAsideClass} border-r-0 border-b border-[rgb(var(--lp-border))] bg-white/88 xl:border-b-0 xl:border-r`}
        style={{ minWidth: "0", maxWidth: "none" }}
      >
        {treeSlot}
      </aside>
      <main className={`${cmsWorkspaceMainSurfaceClass} flex min-h-0 flex-col bg-[rgb(var(--lp-surface-alt))]/75`}>
        {children}
      </main>
    </div>
  );
}
