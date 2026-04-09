/**
 * DnD reorder for CMS block list — domain: reorder IDs in canonical Block[] order (no ad hoc canvas rules).
 */

"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Block } from "./editorBlockTypes";

export function useBlockListDragEndHandler(options: {
  canReorder: boolean;
  setBlocks: Dispatch<SetStateAction<Block[]>>;
}): (event: DragEndEvent) => void {
  const { canReorder, setBlocks } = options;
  return useCallback(
    (event: DragEndEvent) => {
      if (!canReorder) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const aid = String(active.id);
      const oid = String(over.id);
      setBlocks((items) => {
        const oldIndex = items.findIndex((b) => b.id === aid);
        const newIndex = items.findIndex((b) => b.id === oid);
        if (oldIndex < 0 || newIndex < 0) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    },
    [canReorder, setBlocks]
  );
}
