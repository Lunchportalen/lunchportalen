"use client";

/**
 * Editor2-gren ved siden av tri-pane — ren shell-mount rundt placeholder `Editor2Shell`.
 */

import { Editor2Shell } from "./_stubs";

/** Samme kontrakt som tidligere inline-kall; ingen ekstra transform. */
export function ContentWorkspaceEditor2ShellMount(props: Record<string, unknown>) {
  return <Editor2Shell {...props} />;
}
