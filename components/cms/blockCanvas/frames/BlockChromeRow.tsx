"use client";

import type { ReactNode } from "react";

type BlockChromeRowProps = {
  children: ReactNode;
  /** Per-frame chrome density; default matches legacy canvas row. */
  variant?: "default" | "editorial";
  className?: string;
};

/**
 * Shared drag + identity + toolbar lane. U78: editorial frames use a slimmer belt so the block body dominates.
 */
export function BlockChromeRow({ children, variant = "default", className = "" }: BlockChromeRowProps) {
  const density =
    variant === "editorial"
      ? "min-h-[34px] border-b border-slate-200/65 bg-slate-50/25"
      : "min-h-[38px] border-b border-slate-200/80 bg-slate-50/40";

  return (
    <div data-lp-block-chrome className={`flex items-stretch ${density} ${className}`.trim()}>
      {children}
    </div>
  );
}
