"use client";

/**
 * DS icon wrapper — fixed sizes for design-system surfaces.
 * For semantic registry icons site-wide, use `@/components/ui/Icon` (name-based).
 */

import type { LucideIcon } from "lucide-react";

const SIZE_CLASS = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
} as const;

export type DsIconSize = keyof typeof SIZE_CLASS;

export type DsIconProps = {
  icon: LucideIcon;
  size?: DsIconSize;
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
};

export function DsIcon({
  icon: Icon,
  size = "md",
  className = "",
  strokeWidth = 2,
  "aria-hidden": ariaHidden = true,
}: DsIconProps) {
  return (
    <Icon
      className={`inline-flex shrink-0 select-none ${SIZE_CLASS[size]} ${className}`.trim()}
      strokeWidth={strokeWidth}
      aria-hidden={ariaHidden}
    />
  );
}
