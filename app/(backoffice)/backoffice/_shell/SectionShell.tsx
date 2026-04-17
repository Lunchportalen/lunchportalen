"use client";

import type { ReactNode } from "react";
import { cmsSectionTreeAsideClass, cmsWorkspaceMainSurfaceClass } from "@/lib/design/cmsShell";
type SectionShellProps = {
  treeSlot: ReactNode;
  children: ReactNode;
  /** Content `/[id]` editor: én tydelig hovedflate — mindre ekstra grålag. */
  flattenContentDetailSurface?: boolean;
};

/**
 * Umbraco-style section: 280px tree | 1fr workspace (64px rail is in BackofficeShell).
 * Borders and separate scroll areas.
 */
export default function SectionShell({ treeSlot, children, flattenContentDetailSurface }: SectionShellProps) {
  const mainSurfaceClass = flattenContentDetailSurface
    ? "min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden bg-[rgb(var(--lp-bg))]"
    : `${cmsWorkspaceMainSurfaceClass} flex min-h-0 flex-col bg-[rgb(var(--lp-surface-alt))]/75`;

  /** Innholdstre på `/backoffice/content/[id]`: smal, sekundær — ikke bred «workspace»-kolonne. */
  const gridCols = flattenContentDetailSurface
    ? "xl:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]"
    : "xl:grid-cols-[minmax(440px,min(40vw,680px))_minmax(0,1fr)]";

  return (
    <div className={`grid h-full min-h-0 flex-1 grid-cols-1 ${gridCols}`}>
      <aside
        className={`${cmsSectionTreeAsideClass} border-r-0 border-b border-[rgb(var(--lp-border))] ${
          flattenContentDetailSurface ? "bg-[rgb(var(--lp-bg))]/95 xl:bg-[rgb(var(--lp-surface-alt))]/45" : "bg-white/88"
        } xl:border-b-0 xl:border-r`}
        style={{ minWidth: "0", maxWidth: "none" }}
      >
        {treeSlot}
      </aside>
      <main className={mainSurfaceClass}>{children}</main>
    </div>
  );
}
