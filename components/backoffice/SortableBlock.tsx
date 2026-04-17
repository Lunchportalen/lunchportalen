"use client";

/**
 * Backoffice CMS: sortable block shell (dnd-kit).
 * Transform-only layout during drag; drag listeners belong on the handle only (see ContentWorkspace + BlockDragHandle).
 */

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DraggableAttributes } from "@dnd-kit/core";

/** Attributes + pointer listeners from `useSortable` (spread onto drag handle control only). */
export type BlockDragHandleProps = DraggableAttributes & Record<string, unknown>;

export type SortableBlockProps = {
  id: string;
  disabled?: boolean;
  children: (dragHandleProps: BlockDragHandleProps | undefined) => React.ReactNode;
};

/**
 * Umbraco-style sortable row: GPU-friendly transform + opacity while dragging.
 */
function SortableBlockInner({ id, disabled, children }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = React.useMemo(() => {
    const base = transform ? CSS.Transform.toString(transform) : "";
    const dragScale = isDragging ? "scale(0.98)" : "scale(1)";
    const combined = [base, dragScale].filter(Boolean).join(" ");

    return {
      transform: combined || undefined,
      transition: isDragging ? undefined : transition,
      opacity: isDragging ? 0.88 : undefined,
      zIndex: isDragging ? 30 : undefined,
      willChange: isDragging ? ("transform" as const) : undefined,
    } satisfies React.CSSProperties;
  }, [transform, transition, isDragging]);

  const dragHandleProps: BlockDragHandleProps | undefined = disabled
    ? undefined
    : ({ ...attributes, ...listeners } as BlockDragHandleProps);

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "touch-none" : undefined}>
      {children(dragHandleProps)}
    </div>
  );
}

export const SortableBlock = React.memo(SortableBlockInner);

/** @deprecated Prefer `SortableBlock`; kept for imports from `@/components/cms`. */
export const SortableBlockWrapper = SortableBlock;
