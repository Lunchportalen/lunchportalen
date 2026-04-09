"use client";

// STATUS: KEEP

import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}

      {open ? (
        <span
          role="tooltip"
          className={cn(
            "absolute left-1/2 top-full z-[60] mt-2 -translate-x-1/2 whitespace-nowrap",
            "rounded-xl border border-[color:var(--lp-border)] bg-[color:var(--lp-surface)]",
            "px-3 py-2 text-xs text-[color:var(--lp-fg)] shadow-[var(--lp-shadow-sm)]",
            "pointer-events-none",
            className
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
