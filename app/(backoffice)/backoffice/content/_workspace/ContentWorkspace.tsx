"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import SectionShell from "../../_shell/SectionShell";
import ContentTree from "../_tree/ContentTree";
import ContentEditor from "./ContentEditor";

type ContentWorkspaceProps = {
  children?: ReactNode;
  selectedNodeId?: string;
};

type SectionSidebarContent = {
  key: string;
  node: ReactNode;
} | null;

const SectionSidebarContext = createContext<((content: SectionSidebarContent) => void) | null>(null);

export function useSectionSidebarContent() {
  return useContext(SectionSidebarContext);
}

/**
 * Content section layout: tree (280px) + main area (children).
 * Used by content layout to wrap dashboard, editor, or recycle-bin list.
 */
export default function ContentWorkspace({ children, selectedNodeId: initialNodeId }: ContentWorkspaceProps) {
  const [sectionSidebarContent, setSectionSidebarContent] = useState<SectionSidebarContent>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodeId ?? null);

  // Keep local selection aligned when the route loads with a different id.
  useEffect(() => {
    setSelectedNodeId(initialNodeId ?? null);
  }, [initialNodeId]);

  const setSectionSidebarContentStable = (next: SectionSidebarContent) => {
    setSectionSidebarContent((prev) => {
      if (prev?.key === next?.key) return prev;
      return next;
    });
  };

  return (
    <SectionSidebarContext.Provider value={setSectionSidebarContentStable}>
      <SectionShell
        treeSlot={
          <div className="flex h-full flex-col overflow-y-auto">
            <ContentTree selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
            {sectionSidebarContent?.node ?? null}
          </div>
        }
      >
        {selectedNodeId ? <ContentEditor nodeId={selectedNodeId} /> : children}
      </SectionShell>
    </SectionSidebarContext.Provider>
  );
}
