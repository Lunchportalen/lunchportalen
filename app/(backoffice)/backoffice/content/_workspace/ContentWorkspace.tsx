"use client";

import type { ReactNode } from "react";
import SectionShell from "../../_shell/SectionShell";
import ContentTree from "../_tree/ContentTree";

type ContentWorkspaceProps = {
  children: ReactNode;
};

/**
 * Content section layout: tree (280px) + main area (children).
 * Used by content layout to wrap dashboard, editor, or recycle-bin list.
 */
export default function ContentWorkspace({ children }: ContentWorkspaceProps) {
  return (
    <SectionShell treeSlot={<ContentTree />}>
      {children}
    </SectionShell>
  );
}
