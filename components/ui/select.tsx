"use client";

import * as React from "react";
import { Icon } from "@/components/ui/Icon";
import { getSelectVariantClass, type FormControlVariant } from "@/lib/ui/formControlVariants";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

const BASE_LAYOUT = "h-12 w-full appearance-none rounded-2xl pl-4 pr-10 text-sm placeholder:opacity-60 lp-motion-control";

const DEFAULT_STYLES =
  "bg-[color:var(--lp-surface)] text-[color:var(--lp-fg)] border border-[color:var(--lp-border)] shadow-[var(--lp-shadow-sm)] outline-none focus:[box-shadow:0_0_0_4px_rgba(var(--lp-ring),0.22)] focus-visible:[box-shadow:0_0_0_4px_rgba(var(--lp-ring),0.22)] disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[color:var(--lp-surface-2)] active:bg-[color:var(--lp-surface-2)]";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** Visual variant (lp-select-*); omit for default. Prefer outline/soft for dense operational UI. */
  variant?: FormControlVariant;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, variant, ...props },
  ref
) {
  const variantClass = getSelectVariantClass(variant);
  return (
    <div className={cn("relative", className)}>
      <select
        ref={ref}
        className={cn(BASE_LAYOUT, variantClass || DEFAULT_STYLES)}
        {...props}
      >
        {children}
      </select>

      <Icon
        name="chevronDown"
        size="sm"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-70"
      />
    </div>
  );
});
