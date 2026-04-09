"use client";

import type { ReactNode } from "react";

/**
 * Top-level tri-pane grid for content tab: left (structure/AI) · center canvas · right rail.
 * U29R–U30 — Bredere venstre/høyre kolonner; større midtflate til editor+preview.
 * Parent supplies column content; no domain logic.
 */

export type ContentWorkspaceWorkspaceShellProps = {
  canvasMode: "preview" | "edit";
  leftColumn: ReactNode;
  centerColumn: ReactNode;
  rightColumn: ReactNode;
};

export function ContentWorkspaceWorkspaceShell({
  canvasMode,
  leftColumn,
  centerColumn,
  rightColumn,
}: ContentWorkspaceWorkspaceShellProps) {
  if (canvasMode === "preview") {
    return (
      <div className="grid min-h-[min(84vh,1040px)] w-full min-w-0 grid-cols-1 overflow-clip rounded-2xl border border-[rgb(var(--lp-border))]/80 bg-white shadow-sm">
        <div className="min-h-0 min-w-0 overflow-y-auto px-3 py-4 sm:px-5">
          {centerColumn}
        </div>
      </div>
    );
  }

  return (
    <div
      data-lp-content-workspace-shell="tri-pane"
      className="grid min-h-[min(84vh,1040px)] w-full min-w-0 grid-cols-1 gap-0 overflow-clip rounded-2xl border border-[rgb(var(--lp-border))]/80 bg-white shadow-sm xl:grid-cols-[minmax(280px,320px)_minmax(0,1.42fr)_minmax(360px,min(36vw,460px))]"
    >
      <div className="min-h-0 min-w-0 overflow-clip">
        {leftColumn}
      </div>
      {centerColumn}
      <div className="min-h-0 min-w-0 overflow-clip">
        {rightColumn}
      </div>
    </div>
  );
}
