"use client";

import type { ReactNode } from "react";
import { ContentWorkspace } from "../_components/ContentWorkspace";
import { useSectionSidebarContent } from "./ContentWorkspace";

type SectionSidebarContent = {
  key: string;
  node: ReactNode;
} | null;

export default function ContentEditor({
  id,
  setSectionSidebarContent,
}: {
  id: string;
  setSectionSidebarContent?: (content: SectionSidebarContent) => void;
}) {
  const setSectionSidebarContentFromContext = useSectionSidebarContent();

  return (
    <ContentWorkspace
      initialPageId={id}
      embedded
      setSectionSidebarContent={setSectionSidebarContent ?? setSectionSidebarContentFromContext ?? undefined}
    />
  );
}
