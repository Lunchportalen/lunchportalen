"use client";

import * as React from "react";
import { motion, radius, shadow } from "@/lib/design/tokens";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type DsCardVariant = "default" | "interactive" | "selected";

export type DsCardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: DsCardVariant;
};

const BASE = cn(
  "border border-[rgb(var(--lp-border))] bg-white",
  radius.lg,
  shadow.sm,
  motion.transition,
);

const VARIANT: Record<DsCardVariant, string> = {
  default: "",
  interactive: cn(motion.liftHover, "hover:shadow-lg hover:border-pink-400/55"),
  selected: cn("z-[1] ring-2 ring-pink-500/70 bg-pink-50/30 shadow-md"),
};

export const DsCard = React.forwardRef<HTMLDivElement, DsCardProps>(function DsCard(
  { className, variant = "default", ...props },
  ref,
) {
  return <div ref={ref} className={cn(BASE, VARIANT[variant], className)} {...props} />;
});
