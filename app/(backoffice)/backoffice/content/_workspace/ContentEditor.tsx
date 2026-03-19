"use client";

import { ContentWorkspace } from "../_components/ContentWorkspace";

export default function ContentEditor({ nodeId }: { nodeId: string }) {
  return <ContentWorkspace initialPageId={nodeId} embedded />;
}
