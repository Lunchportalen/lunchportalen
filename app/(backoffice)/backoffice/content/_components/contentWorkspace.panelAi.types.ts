import type { Dispatch, SetStateAction } from "react";
import type { Block } from "./editorBlockTypes";
import type { ContentPage } from "./ContentWorkspaceState";
import type { SaveState } from "./types";

/** Felles input til `useContentWorkspacePanelRequests` og underliggende panel-AI-hooks (FASE 10). */
export type UseContentWorkspacePanelRequestsParams = {
  effectiveId: string | null;
  showBlocks: boolean;
  isContentTab: boolean;
  cmsEditorRole: string | null;
  selectedBlockId: string | null;
  setSelectedBlockId: Dispatch<SetStateAction<string | null>>;
  title: string;
  slug: string;
  page: ContentPage | null;
  blocks: Block[];
  displayBlocks: Block[];
  setBlocks: Dispatch<SetStateAction<Block[]>>;
  setTitle: Dispatch<SetStateAction<string>>;
  setSaveStateSafe: (next: SaveState) => void;
  isWow: boolean;
  showAfter: boolean;
  originalBlocks: Block[] | null;
  setOriginalBlocks: Dispatch<SetStateAction<Block[] | null>>;
};
