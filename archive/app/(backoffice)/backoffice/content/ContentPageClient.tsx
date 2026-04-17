"use client";

// STATUS: ARCHIVE

import ContentDashboard from "./_workspace/ContentDashboard";

/**
 * Client entry for content section (baseline rebuild).
 * layout.tsx already wraps routes with _workspace/ContentWorkspaceLayout (single SectionShell).
 * Do not nest another ContentWorkspace here — that would duplicate the tree column.
 */
export function ContentPageClient() {
  return <ContentDashboard />;
}
