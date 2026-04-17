"use client";

import type { ReactNode } from "react";
import { motion, radius, shadow } from "@/lib/design/tokens";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type AiPanelProps = {
  children: ReactNode;
  className?: string;
};

/** Bordered surface for AI tool strips (keeps spacing + elevation consistent). */
export function AiPanel({ children, className }: AiPanelProps) {
  return (
    <div
      className={cn(
        "mx-auto mb-3 flex w-full max-w-3xl flex-col gap-3",
        radius.lg,
        "border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-3",
        shadow.sm,
        motion.transition,
        className,
      )}
    >
      {children}
    </div>
  );
}
