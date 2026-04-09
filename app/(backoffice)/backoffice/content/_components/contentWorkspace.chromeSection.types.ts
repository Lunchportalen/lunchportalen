import type { ContentPage } from "./ContentWorkspaceState";
import type { Block } from "./editorBlockTypes";

export type ContentWorkspaceChromeTriPaneLeftProps = {
  selectedId: string;
  selectedBlockId: string | null;
  onSelectBlockFromTree: (id: string) => void;
  hoverBlockId: string | null;
  setHoverBlockId: (id: string | null) => void;
  displayBlocks: Block[];
  showBlocks: boolean;
  title: string;
  page: ContentPage | null;
  slug: string;
  effectiveId: string | null;
  aiCapability: "loading" | "available" | "unavailable";
  aiSummary: string | null;
  aiError: string | null;
};
