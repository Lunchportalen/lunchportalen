"use client";

/**
 * Editor workspace chrome: composes header chrome + (lower controls exported from publish bar module).
 * No domain or transport logic — props only.
 */

import { ContentWorkspaceHeaderChrome } from "./ContentWorkspaceHeaderChrome";
import type { ContentWorkspaceEditorChromeProps } from "./ContentWorkspaceEditorChrome.types";
export type { ContentWorkspaceEditorChromeProps } from "./ContentWorkspaceEditorChrome.types";
export {
  ContentWorkspacePublishBar,
  ContentWorkspaceEditorLowerControls,
  type ContentWorkspacePublishBarProps,
  type ContentWorkspaceEditorLowerControlsProps,
} from "./ContentWorkspacePublishBar";

export function ContentWorkspaceEditorChrome(props: ContentWorkspaceEditorChromeProps) {
  return <ContentWorkspaceHeaderChrome {...props} />;
}
