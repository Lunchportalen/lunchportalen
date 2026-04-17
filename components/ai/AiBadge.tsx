"use client";

import { radius } from "@/lib/design/tokens";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type AiBadgeProps = {
  children?: React.ReactNode;
  className?: string;
};

/** Small “AI” affordance chip. */
export function AiBadge({ children = "AI", className }: AiBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-pink-400/50 bg-pink-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-700",
        radius.sm,
        className,
      )}
    >
      {children}
    </span>
  );
}
