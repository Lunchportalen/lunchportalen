"use client";

import type { ReactNode } from "react";

/**
 * Sidebar panel: wraps left-column content (tree, Hjem, Global, Design, create panel).
 * Structure only; content is passed as children from ContentWorkspace.
 */
export function ContentWorkspaceSidebarPanel({ children }: { children: ReactNode }) {
  return <div className="space-y-2 p-3">{children}</div>;
}

/**
 * Main panel: wraps main area content (topbar, save bar, design/content/global views, blocks, right panels).
 * Structure only; content is passed as children from ContentWorkspace.
 */
export function ContentWorkspaceMainPanel({ children }: { children: ReactNode }) {
  return <div className="w-full min-w-0 px-4 py-6 md:px-6">{children}</div>;
}
