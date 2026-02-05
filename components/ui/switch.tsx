"use client";

import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, id, ...props },
  ref
) {
  const autoId = React.useId();
  const inputId = id ?? `sw_${autoId}`;

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
            "peer sr-only",
            className
          )}
          {...props}
        />

        {/* track */}
        <span
          aria-hidden="true"
          className={cn(
            "relative inline-flex h-7 w-12 items-center rounded-full",
            "border border-[color:var(--lp-border)]",
            "bg-[color:var(--lp-surface)]",
            "shadow-[var(--lp-shadow-sm)]",
            "transition-[background-color,border-color,box-shadow] duration-200 [transition-timing-function:var(--lp-ease)]",
            "peer-focus-visible:[box-shadow:0_0_0_4px_var(--lp-ring)]",
            "peer-checked:bg-[color:var(--lp-accent)] peer-checked:border-transparent",
            "peer-checked:hover:bg-[color:var(--lp-accent-2)]"
          )}
        >
          {/* thumb */}
          <span
            className={cn(
              "absolute left-1 top-1 h-5 w-5 rounded-full",
              "bg-white shadow",
              "transition-[transform] duration-200 [transition-timing-function:var(--lp-ease)]",
              "peer-checked:translate-x-5"
            )}
          />
        </span>
      </span>

      {label ? (
        <span className="text-sm text-[color:var(--lp-fg)]">{label}</span>
      ) : null}
    </label>
  );
});
