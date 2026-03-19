"use client";

import * as React from "react";
import { Icon } from "@/components/ui/Icon";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, id, disabled, ...props },
  ref
) {
  const autoId = React.useId();
  const inputId = id ?? `cb_${autoId}`;

  return (
    <label
      htmlFor={inputId}
      aria-disabled={disabled ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-3",
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      )}
    >
      {/* Only the control should be non-selectable */}
      <span className="relative inline-flex select-none">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          className={cn(
            "peer h-5 w-5 appearance-none rounded-md",
            "bg-[color:var(--lp-surface)]",
            "border border-[color:var(--lp-border)]",
            "shadow-[var(--lp-shadow-sm)]",
            "outline-none",
            "lp-motion-control",
            "hover:bg-[color:var(--lp-surface-2)]",
            "focus:[box-shadow:0_0_0_4px_rgba(var(--lp-ring),0.22)] focus-visible:[box-shadow:0_0_0_4px_rgba(var(--lp-ring),0.22)]",
            "checked:bg-[color:var(--lp-accent)] checked:border-transparent",
            "checked:hover:bg-[color:var(--lp-accent-2)]",
            "active:scale-[0.98]",
            "disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-[color:var(--lp-surface)]",
            className
          )}
          {...props}
        />

        <Icon
          name="success"
          size="md"
          className="lp-motion-opacity pointer-events-none absolute left-0 top-0 opacity-0 peer-checked:opacity-100 stroke-white stroke-[2.2]"
        />
      </span>

      {label ? (
        // Label text must be selectable/copyable
        <span className="text-sm text-[color:var(--lp-fg)] select-text">{label}</span>
      ) : null}
    </label>
  );
});
