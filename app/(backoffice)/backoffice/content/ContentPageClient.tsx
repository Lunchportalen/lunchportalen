"use client";

import ContentWorkspace from "./_workspace/ContentWorkspace";
import ContentDashboard from "./_workspace/ContentDashboard";

/**
 * Client entry for content section (baseline rebuild).
 * Uses local _workspace only; no API, no _components/ContentWorkspace.
 */
export function ContentPageClient() {
  return (
    <ContentWorkspace>
      <ContentDashboard />
    </ContentWorkspace>
  );
}
