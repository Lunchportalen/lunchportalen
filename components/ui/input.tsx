// components/ui/input.tsx
"use client";

import * as React from "react";
import { getInputVariantClass, type FormControlVariant } from "@/lib/ui/formControlVariants";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

const BASE_LAYOUT = "h-12 w-full min-h-[44px] px-4 text-sm placeholder:opacity-60 lp-motion-control";

const DEFAULT_STYLES =
  "rounded-2xl bg-[color:var(--lp-surface)] text-[color:var(--lp-fg)] border border-[color:var(--lp-border)] shadow-[var(--lp-shadow-sm)] outline-none focus:[box-shadow:0_0_0_4px_rgba(var(--lp-ring),0.22)] focus-visible:[box-shadow:0_0_0_4px_rgba(var(--lp-ring),0.22)] disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[color:var(--lp-surface-2)] active:bg-[color:var(--lp-surface-2)]";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Visual variant (lp-input-*); omit for default. Prefer outline/soft for dense operational UI. */
  variant?: FormControlVariant;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", variant, ...props },
  ref
) {
  const variantClass = getInputVariantClass(variant);
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        BASE_LAYOUT,
        variantClass || DEFAULT_STYLES,
        className
      )}
      {...props}
    />
  );
});
