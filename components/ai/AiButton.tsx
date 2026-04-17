"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { DsIcon } from "@/components/ui/ds";

export type AiButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Show sparkle icon (default true). */
  showIcon?: boolean;
};

/**
 * Primary AI affordance — gradient + motion; use for “generate with AI” entry points.
 */
export const AiButton = React.forwardRef<HTMLButtonElement, AiButtonProps>(function AiButton(
  { className = "", children, showIcon = true, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 " +
        "px-4 py-2 text-xs font-semibold text-white shadow-md transition-all duration-200 " +
        "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/40 focus-visible:ring-offset-2 " +
        className
      }
      {...props}
    >
      {showIcon ? <DsIcon icon={Sparkles} size="sm" className="opacity-95" /> : null}
      {children}
    </button>
  );
});
