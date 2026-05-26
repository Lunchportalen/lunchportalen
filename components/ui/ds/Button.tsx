"use client";

import * as React from "react";
import { focusRing, motion, radius, shadow, spacing } from "@/lib/design/tokens";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type DsButtonVariant = "primary" | "secondary" | "ghost";

export type DsButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: DsButtonVariant;
};

const VARIANT: Record<DsButtonVariant, string> = {
  primary: cn(
    "inline-flex items-center justify-center gap-2 font-semibold text-white",
    "bg-gradient-to-r from-pink-500 to-purple-600",
    shadow.md,
    radius.lg,
    "min-h-[44px] px-4 py-2",
    "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-45",
    focusRing,
  ),
  secondary: cn(
    "inline-flex items-center justify-center gap-2 font-medium text-[rgb(var(--lp-text))]",
    "border-2 border-dashed border-[rgb(var(--lp-border))] bg-white",
    radius.lg,
    shadow.sm,
    "min-h-[48px] px-5 py-3",
    motion.transition,
    motion.liftHover,
    "hover:border-pink-400/60 hover:shadow-md",
    "disabled:opacity-50",
    focusRing,
  ),
  ghost: cn(
    "inline-flex items-center justify-center gap-2 font-medium text-[rgb(var(--lp-text))]",
    radius.md,
    spacing.xs,
    "min-h-[40px] px-3",
    motion.transition,
    "hover:bg-pink-50/80",
    "disabled:opacity-50",
    focusRing,
  ),
};

export const DsButton = React.forwardRef<HTMLButtonElement, DsButtonProps>(function DsButton(
  { className, variant = "primary", type, ...props },
  ref,
) {
  return <button ref={ref} type={type ?? "button"} className={cn(VARIANT[variant], className)} {...props} />;
});
