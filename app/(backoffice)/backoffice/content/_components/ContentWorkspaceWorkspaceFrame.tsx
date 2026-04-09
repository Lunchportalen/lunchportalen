"use client";

import type { ReactNode } from "react";

export type ContentWorkspaceWorkspaceFrameProps = {
  hideLegacySidebar: boolean;
  legacySidebar: ReactNode;
  children: ReactNode;
};

/** Ytre grid/section + padded hovedkolonne — kun layout, ingen domene. */
export function ContentWorkspaceWorkspaceFrame({
  hideLegacySidebar,
  legacySidebar,
  children,
}: ContentWorkspaceWorkspaceFrameProps) {
  return (
    <div
      className={
        hideLegacySidebar
          ? "flex h-full min-h-0 min-w-0 flex-1 flex-col bg-slate-200/60"
          : "grid h-full grid-cols-1 bg-slate-200/60 md:grid-cols-[280px_minmax(0,1fr)]"
      }
    >
      {!hideLegacySidebar ? legacySidebar : null}
      <section
        className={
          hideLegacySidebar
            ? "min-h-0 min-w-0 flex-1 overflow-y-auto bg-[rgb(var(--lp-card))]"
            : "min-h-0 min-w-0 overflow-y-auto bg-[rgb(var(--lp-card))]"
        }
      >
        <div className="w-full min-w-0 px-4 py-6 md:px-6">{children}</div>
      </section>
    </div>
  );
}
