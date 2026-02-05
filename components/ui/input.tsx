// components/ui/input.tsx
"use client";

import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        // Base
        "h-12 w-full rounded-2xl px-4 text-sm",
        "bg-[color:var(--lp-surface)] text-[color:var(--lp-fg)]",
        // Border / shadow
        "border border-[color:var(--lp-border)] shadow-[var(--lp-shadow-sm)]",
        // Placeholder
        "placeholder:opacity-60",
        // Focus (same ring language as Button/Card)
        "outline-none focus:[box-shadow:0_0_0_4px_rgba(var(--lp-ring),0.22)]",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-70",
        // Motion (subtle)
        "transition-[box-shadow,border-color,background-color] duration-200 [transition-timing-function:var(--lp-ease)]",
        // Optional: slightly soften on hover
        "hover:bg-[color:var(--lp-surface-2)]",
        className
      )}
      {...props}
    />
  );
});
