"use client";

import type { ReactNode } from "react";

export type ContentWorkspaceShellProps = {
  hideLegacySidebar: boolean;
  /** Content inside the left aside (tree, create panel, etc.). Not rendered when hideLegacySidebar. */
  sidebar: ReactNode;
  /** Main area: topbar, save bar, canvas, right panels. */
  main: ReactNode;
};

/**
 * Layout wrapper for ContentWorkspace.
 * Renders root grid/flex container, optional left aside with "Content" header, and main section.
 * No behavior change; structure only.
 */
export function ContentWorkspaceShell({
  hideLegacySidebar,
  sidebar,
  main,
}: ContentWorkspaceShellProps) {
  return (
    <>
      <div
        className={
          hideLegacySidebar
            ? "flex h-full min-h-0 min-w-0 flex-1 flex-col bg-slate-200/60"
            : "grid h-full grid-cols-1 bg-slate-200/60 md:grid-cols-[280px_minmax(0,1fr)]"
        }
      >
        {!hideLegacySidebar && (
          <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-100 md:border-b-0 md:border-r md:border-slate-200">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">Content</p>
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col">
              {sidebar}
            </div>
          </aside>
        )}
        <section
          className={
            hideLegacySidebar
              ? "min-h-0 min-w-0 flex-1 overflow-y-auto lp-surface-soft"
              : "min-h-0 min-w-0 overflow-y-auto lp-surface-soft"
          }
        >
          {main}
        </section>
      </div>
    </>
  );
}
