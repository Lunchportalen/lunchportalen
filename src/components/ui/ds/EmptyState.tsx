"use client";

import type { ReactNode } from "react";
import { motion, radius, shadow } from "@/lib/design/tokens";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type DsEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function DsEmptyState({ icon, title, description, actions, className }: DsEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "rounded-2xl border border-dashed border-[rgb(var(--lp-border))]",
        "bg-gradient-to-b from-white to-[rgb(var(--lp-card))]/30",
        "px-6 py-10",
        shadow.sm,
        motion.transition,
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mb-4 flex h-14 w-14 items-center justify-center text-[rgb(var(--lp-muted))]",
            "border border-[rgb(var(--lp-border))]/80 bg-white",
            radius.lg,
            shadow.sm,
          )}
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold tracking-tight text-[rgb(var(--lp-text))]">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[rgb(var(--lp-muted))]">{description}</p>
      ) : null}
      {actions ? <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">{actions}</div> : null}
    </div>
  );
}
