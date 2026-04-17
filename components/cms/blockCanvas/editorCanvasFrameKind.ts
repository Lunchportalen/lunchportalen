import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import {
  getCanvasFrameKindForBlockType,
  type BlockCanvasFrameKind,
} from "@/lib/cms/blocks/blockTypeDefinitions";

/** Which editor canvas outer frame wraps this block in WorkspaceBody (U78). */
export type EditorCanvasFrameKind = BlockCanvasFrameKind;

export function editorCanvasFrameKind(block: Block): EditorCanvasFrameKind {
  return getCanvasFrameKindForBlockType(block.type);
}
