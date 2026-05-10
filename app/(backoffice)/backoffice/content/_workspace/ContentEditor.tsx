"use client";

import dynamic from "next/dynamic";

const ContentWorkspace = dynamic(
  () => import("../_components/ContentWorkspace").then((mod) => mod.ContentWorkspace),
  {
    loading: () => (
      <div className="h-32 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />
    ),
    ssr: false,
  },
);

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
