import type { ReactNode } from "react";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import type { BlockDragHandleProps } from "@/components/backoffice/SortableBlock";

/** U80B: Data + callbacks for canvas frames — layout/chrome is owned inside each *CanvasFrame. */
export type EditorBlockCanvasFrameProps = {
  block: Block;
  index: number;
  open: boolean;
  canReorderBlocks: boolean;
  dragHandleProps: BlockDragHandleProps | undefined;
  collapsedBody: ReactNode;
  onActivateCollapsed: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  disabledMoveUp: boolean;
  disabledMoveDown: boolean;
  /** Shown when the block row is expanded (open). */
  subtitleWhenOpen: string | null;
  /** `/backoffice/content/[id]`: roligere kort-krom (presentasjon). */
  calmDetailBlockChrome?: boolean;
  /** Detail dokument: egenskapseditor i samme seksjonskort (ikke søsken under). */
  inlineEditor?: ReactNode;
};
