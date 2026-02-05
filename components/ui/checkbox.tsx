"use client";

import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, id, ...props },
  ref
) {
  const autoId = React.useId();
  const inputId = id ?? `cb_${autoId}`;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex items-center gap-3 select-none",
        props.disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      )}
    >
      <span className="relative inline-flex">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn(
            "peer h-5 w-5 appearance-none rounded-md",
            "bg-[color:var(--lp-surface)]",
            "border border-[color:var(--lp-border)]",
            "shadow-[var(--lp-shadow-sm)]",
            "outline-none",
            "transition-[box-shadow,border-color,background-color,transform] duration-200 [transition-timing-function:var(--lp-ease)]",
            "hover:bg-[color:var(--lp-surface-2)]",
            "focus:[box-shadow:0_0_0_4px_var(--lp-ring)]",
            "checked:bg-[color:var(--lp-accent)] checked:border-transparent",
            "checked:hover:bg-[color:var(--lp-accent-2)]",
            "active:scale-[0.98]",
            className
          )}
          {...props}
        />

        {/* check icon */}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-0 top-0 h-5 w-5 opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
          fill="none"
        >
          <path
            d="M5 10.5l3 3L15.5 6"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {label ? (
        <span className="text-sm text-[color:var(--lp-fg)]">{label}</span>
      ) : null}
    </label>
  );
});
