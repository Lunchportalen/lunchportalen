"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import { motion } from "@/lib/design/tokens";
import type { BlockDragHandleProps as DndDragHandleProps } from "@/components/backoffice/SortableBlock";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type BlockDragHandleCmProps = {
  dragHandleProps: DndDragHandleProps;
  ariaLabel?: string;
  /** When false, handle fades in on card hover (cleaner default). */
  alwaysVisible?: boolean;
  /** When true, sits in the chrome column (no absolute offset). */
  embedded?: boolean;
  /**
   * `detailQuiet` = content detail block list: minimal Umbraco-like handle (no heavy chrome).
   */
  chrome?: "default" | "detailQuiet";
};

/**
 * Top-left drag handle only — prevents accidental drags from content / contentEditable.
 */
export function BlockDragHandle({
  dragHandleProps,
  ariaLabel = "Dra for å endre rekkefølge",
  alwaysVisible = false,
  embedded = false,
  chrome = "default",
}: BlockDragHandleCmProps) {
  const quiet = chrome === "detailQuiet";
  return (
    <button
      type="button"
      className={cn(
        embedded
          ? cn(
              "relative left-auto top-auto z-[25] flex items-center justify-center",
              quiet ? "h-6 w-6" : "h-8 w-8",
            )
          : "absolute left-1.5 top-1.5 z-[25] flex h-8 w-8 items-center justify-center",
        quiet
          ? "rounded border-0 bg-transparent opacity-45 shadow-none hover:bg-slate-100/50 hover:opacity-90 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-slate-300/30"
          : "rounded-md border border-[rgb(var(--lp-border))]/90 bg-white shadow-sm hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-pink-500/35",
        `${motion.transitionFast} cursor-grab touch-none active:cursor-grabbing`,
        "focus:outline-none",
        "transition-[opacity,transform,background-color,border-color] duration-200 ease-out will-change-[opacity,transform]",
        embedded || alwaysVisible
          ? "opacity-100"
          : "opacity-0 scale-[0.96] group-hover/block-card:opacity-100 group-hover/block-card:scale-100 focus-visible:opacity-100 focus-visible:scale-100",
      )}
      aria-label={ariaLabel}
      title={ariaLabel}
      {...dragHandleProps}
    >
      <GripVertical
        className={cn(quiet ? "h-3 w-3 text-slate-300" : "h-4 w-4 text-[rgb(var(--lp-muted))]")}
        aria-hidden
      />
    </button>
  );
}
