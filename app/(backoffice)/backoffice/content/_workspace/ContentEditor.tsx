"use client";

import { ContentWorkspace } from "../_components/ContentWorkspace";

export default function ContentEditor({
  nodeId,
  initialFocusBlockId,
}: {
  nodeId: string;
  initialFocusBlockId?: string | null;
}) {
  return (
    <ContentWorkspace
      initialPageId={nodeId}
      embedded
      initialFocusBlockId={initialFocusBlockId ?? undefined}
    />
  );
}
