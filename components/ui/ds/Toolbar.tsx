"use client";

import * as React from "react";
import { motion, radius, shadow } from "@/lib/design/tokens";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type DsToolbarProps = React.HTMLAttributes<HTMLDivElement> & {
  /** When true, toolbar fades in on parent `group-hover` / `group-focus-within` (md+). */
  revealOnGroupHover?: boolean;
  /** `overlay` = floating top-right (default). `inline` = block chrome row (no absolute positioning). */
  attach?: "overlay" | "inline";
};

export const DsToolbar = React.forwardRef<HTMLDivElement, DsToolbarProps>(function DsToolbar(
  { className, revealOnGroupHover = true, attach = "overlay", role = "toolbar", ...props },
  ref,
) {
  const reveal = revealOnGroupHover
    ? cn(
        "opacity-100 translate-y-0 max-md:shadow-md",
        "md:pointer-events-none md:opacity-0 md:translate-y-1",
        "md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-hover:translate-y-0",
        "md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:translate-y-0",
      )
    : "opacity-100";

  const attachCls =
    attach === "inline"
      ? cn(
          "relative right-auto top-auto z-20 flex items-center gap-px",
          "border-0 bg-transparent px-0 py-0 shadow-none backdrop-blur-0",
        )
      : cn(
          "absolute right-2 top-2 z-20 flex items-center gap-0.5",
          "border border-[rgb(var(--lp-border))]/70 bg-white/90 px-1 py-1",
          shadow.md,
          "backdrop-blur-md",
          radius.lg,
        );

  return (
    <div
      ref={ref}
      role={role}
      className={cn(attachCls, motion.transition, reveal, className)}
      {...props}
    />
  );
});
