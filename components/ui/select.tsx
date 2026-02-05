"use client";

import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <div className={cn("relative", className)}>
      <select
        ref={ref}
        className={cn(
          "h-12 w-full appearance-none rounded-2xl pl-4 pr-10 text-sm",
          "bg-[color:var(--lp-surface)] text-[color:var(--lp-fg)]",
          "border border-[color:var(--lp-border)] shadow-[var(--lp-shadow-sm)]",
          "placeholder:opacity-60",
          "outline-none focus:[box-shadow:0_0_0_4px_var(--lp-ring)]",
          "disabled:cursor-not-allowed disabled:opacity-70",
          "transition-[box-shadow,border-color,background-color] duration-200 [transition-timing-function:var(--lp-ease)]",
          "hover:bg-[color:var(--lp-surface-2)]"
        )}
        {...props}
      >
        {children}
      </select>

      {/* caret */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-70"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
});
