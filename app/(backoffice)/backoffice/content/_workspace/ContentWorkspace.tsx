"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import SectionShell from "../../_shell/SectionShell";
import ContentTree from "../_tree/ContentTree";

type ContentWorkspaceProps = {
  children: ReactNode;
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
export default function ContentWorkspace({ children }: ContentWorkspaceProps) {
  const [sectionSidebarContent, setSectionSidebarContent] = useState<SectionSidebarContent>(null);

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
            <ContentTree />
            {sectionSidebarContent?.node ?? null}
          </div>
        }
      >
        {children}
      </SectionShell>
    </SectionSidebarContext.Provider>
  );
}
