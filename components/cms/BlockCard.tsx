"use client";

import * as React from "react";
import { motion } from "@/lib/design/tokens";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type BlockCardProps = React.HTMLAttributes<HTMLElement> & {
  domId: string;
  blockId: string;
  selected: boolean;
  /** Sync hover with live preview rail + structure tree */
  hoverSync: boolean;
  /** Duplicate micro-feedback */
  pulse?: boolean;
  /**
   * `shell` = klassisk hvit CMS-kort (standardblokker).
   * `frame` = gjennomsiktig wrapper; ytre form tegnes av blokkens canvas-frame (U80C).
   */
  chrome?: "shell" | "frame";
  /** Content detail route: mykere ramme/valgt-state uten tung builder-krom. */
  calmDetailBlockChrome?: boolean;
  /**
   * Content detail block list: ytre artikkel uten egen flate — inner `ContentDetailCompactBlockFrame` eier kortkant.
   * Unngår dobbel border mellom shell og inner card.
   */
  contentDetailBareShell?: boolean;
};

/**
 * CMS block shell: editorial node chrome — distinct selected vs hover-sync vs idle.
 */
const BlockCardInner = React.forwardRef<HTMLElement, BlockCardProps>(function BlockCardInner(
  {
    domId,
    blockId,
    selected,
    hoverSync,
    pulse,
    chrome = "shell",
    calmDetailBlockChrome = false,
    contentDetailBareShell = false,
    className,
    children,
    style,
    ...rest
  },
  ref,
) {
  const frameChrome = chrome === "frame";
  const calm = calmDetailBlockChrome;
  const bareDetail = Boolean(contentDetailBareShell && !frameChrome);

  return (
    <article
      ref={ref as React.Ref<HTMLElement>}
      id={domId}
      data-block-id={blockId}
      data-lp-block-card
      data-lp-block-chrome={chrome}
      data-lp-block-selected={selected ? "true" : "false"}
      data-lp-block-calm-detail={calm ? "true" : "false"}
      data-lp-block-bare-detail-shell={bareDetail ? "true" : "false"}
      data-lp-block-hover-sync={hoverSync && !selected ? "true" : "false"}
      aria-current={selected ? "true" : undefined}
      style={style}
      className={cn(
        "group/block-card relative",
        frameChrome
          ? "overflow-visible rounded-none border-0 bg-transparent shadow-none"
          : bareDetail
            ? cn(
                "overflow-visible rounded-none border-0 border-b border-slate-100/[0.55] bg-transparent shadow-none transition-colors duration-150 last:border-b-0",
                selected ? "z-[1]" : "",
                hoverSync ? "bg-transparent" : "",
                "hover:bg-transparent",
              )
            : "overflow-hidden rounded-lg border bg-white shadow-sm",
        motion.transition,
        pulse ? "animate-block-pulse" : "",
        bareDetail
          ? ""
          : selected
            ? frameChrome
              ? calm
                ? "z-[1] ring-1 ring-slate-400/45 ring-offset-1 ring-offset-[rgb(var(--lp-card))]"
                : "z-[1] ring-2 ring-pink-500/55 ring-offset-2 ring-offset-[rgb(var(--lp-card))]"
              : calm
                ? "z-[1] border-slate-400/90 bg-slate-50/70 shadow-[0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-slate-400/35 ring-offset-0"
                : "z-[1] border-slate-400/95 shadow-md ring-2 ring-pink-500/45 ring-offset-1 ring-offset-white"
            : frameChrome
              ? cn(
                  hoverSync ? (calm ? "ring-1 ring-slate-300/40" : "ring-1 ring-slate-400/35") : "",
                  calm ? "hover:ring-1 hover:ring-slate-300/50" : "hover:ring-1 hover:ring-slate-400/45",
                )
              : cn(
                  calm ? "border-slate-200/75" : "border-slate-200/90",
                  hoverSync ? (calm ? "border-slate-200/90 bg-slate-50/40 shadow-none" : "border-slate-300/90 bg-slate-50/55 shadow-sm") : "bg-white",
                  calm
                    ? "hover:border-slate-300/90 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                    : "hover:border-slate-300 hover:shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
                ),
        className,
      )}
      {...rest}
    >
      {selected && !frameChrome && !bareDetail ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-[2]",
            calm ? "w-[3px] bg-slate-500/85" : "w-[3px] bg-pink-500",
          )}
          aria-hidden
          data-lp-block-selection-accent
        />
      ) : null}
      {children}
    </article>
  );
});

BlockCardInner.displayName = "BlockCard";

export const BlockCard = React.memo(BlockCardInner);
