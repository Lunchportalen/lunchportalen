// components/ui/textarea.tsx
"use client";

import * as React from "react";
import { getTextareaVariantClass, type FormControlVariant } from "@/lib/ui/formControlVariants";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

const BASE_LAYOUT = "w-full rounded-2xl px-4 py-3 text-sm placeholder:opacity-60 lp-motion-control";

const DEFAULT_STYLES =
  "bg-[color:var(--lp-surface)] text-[color:var(--lp-fg)] border border-[color:var(--lp-border)] shadow-[var(--lp-shadow-sm)] outline-none focus:[box-shadow:0_0_0_4px_rgba(var(--lp-ring),0.22)] focus-visible:[box-shadow:0_0_0_4px_rgba(var(--lp-ring),0.22)] disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[color:var(--lp-surface-2)] active:bg-[color:var(--lp-surface-2)]";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Visual variant (lp-textarea-*); omit for default. Prefer outline/soft for dense operational UI. */
  variant?: FormControlVariant;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, variant, ...props },
  ref
) {
  const variantClass = getTextareaVariantClass(variant);
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(BASE_LAYOUT, variantClass || DEFAULT_STYLES, className)}
      {...props}
    />
  );
});
