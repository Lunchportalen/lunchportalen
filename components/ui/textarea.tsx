// components/ui/textarea.tsx
"use client";

import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-2xl px-4 py-3 text-sm",
        "bg-[color:var(--lp-surface)] text-[color:var(--lp-fg)]",
        "border border-[color:var(--lp-border)] shadow-[var(--lp-shadow-sm)]",
        "placeholder:opacity-60",
        "outline-none focus:[box-shadow:0_0_0_4px_var(--lp-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-70",
        "transition-[box-shadow,border-color,background-color] duration-200 [transition-timing-function:var(--lp-ease)]",
        "hover:bg-[color:var(--lp-surface-2)]",
        className
      )}
      {...props}
    />
  );
});
