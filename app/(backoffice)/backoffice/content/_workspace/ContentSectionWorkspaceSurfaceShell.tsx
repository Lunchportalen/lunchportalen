"use client";

import type { ReactNode } from "react";

import { WorkspaceFooter } from "../_components/WorkspaceFooter";
import { WorkspaceHeader } from "../_components/WorkspaceHeader";

export function ContentSectionWorkspaceSurfaceShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <WorkspaceHeader />
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <WorkspaceFooter />
    </div>
  );
}
