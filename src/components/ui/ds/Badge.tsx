"use client";

import * as React from "react";
import { radius } from "@/lib/design/tokens";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type DsBadgeVariant = "muted" | "outline";

export type DsBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: DsBadgeVariant;
};

const VARIANT: Record<DsBadgeVariant, string> = {
  muted: "border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/70 text-[rgb(var(--lp-muted))]",
  outline: "border border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]",
};

export function DsBadge({ className, variant = "muted", ...props }: DsBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        radius.sm,
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}
