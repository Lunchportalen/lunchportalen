"use client";

import type { BlockList } from "./_stubs";
import { ContentWorkspaceEditor2ShellMount } from "./ContentWorkspaceEditor2ShellMount";
import { ContentWorkspaceTriPaneMount } from "./contentWorkspaceTriPaneShellBundle";
import type { ContentWorkspaceTriPaneMountProps } from "./contentWorkspaceTriPaneMountProps";

/**
 * Velger Editor2- eller tri-pane-mount for innholdsside. Ren struktur-split fra ContentWorkspacePageEditorShell (Phase 1C).
 */
export function ContentWorkspaceEditorMountRouter(props: {
  useEditor2: boolean;
  editor2Model: BlockList | null;
  editor2MountProps: Record<string, unknown>;
  triPaneMountProps: ContentWorkspaceTriPaneMountProps;
}) {
  const { useEditor2, editor2Model, editor2MountProps, triPaneMountProps } = props;
  if (useEditor2 && editor2Model !== null) {
    return <ContentWorkspaceEditor2ShellMount {...editor2MountProps} />;
  }
  return <ContentWorkspaceTriPaneMount {...triPaneMountProps} />;
}
