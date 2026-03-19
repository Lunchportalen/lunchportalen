"use client";

import { ContentWorkspace } from "../_components/ContentWorkspace";

export default function ContentEditor({ id }: { id: string }) {
  return <ContentWorkspace initialPageId={id} embedded />;
}
