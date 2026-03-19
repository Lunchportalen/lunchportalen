"use client";

/**
 * LUNCHPORTALEN — Shared icon primitive.
 * Loads icon from registry, normalizes size/stroke/alignment.
 * Use semantic names (e.g. name="add") so intent is centralized.
 *
 * Accessibility: Icons are decorative by default (aria-hidden="true").
 * - Decorative icons (next to text or in labelled controls) → keep default.
 * - Icon-only buttons/links → put the accessible name on the control (aria-label or visible text).
 * - Icons must not replace necessary text; use them to reinforce, not as the only label.
 */

import { getIcon, type SemanticIconKey } from "@/lib/iconRegistry";
import type { LucideProps } from "lucide-react";

const SIZE_CLASS = {
  xs: "lp-icon-xs",
  sm: "lp-icon-sm",
  md: "lp-icon-md",
  lg: "lp-icon-lg",
} as const;

export type IconSize = keyof typeof SIZE_CLASS;

export type IconProps = {
  /** Semantic icon name (from registry). */
  name: SemanticIconKey;
  /** Normalized size; maps to design tokens. */
  size?: IconSize;
  /** Stroke width (default 2). */
  strokeWidth?: number;
  /** Extra class names (merged with size/alignment). */
  className?: string;
  /** Default true: icon is decorative (screen readers skip). Set false only when icon conveys meaning and has no parent label. */
  "aria-hidden"?: boolean;
} & Omit<LucideProps, "size" | "strokeWidth">;

const ALIGNMENT_CLASS = "inline-flex shrink-0 select-none";

export function Icon({
  name,
  size = "md",
  strokeWidth = 2,
  className = "",
  "aria-hidden": ariaHidden = true,
  ...rest
}: IconProps) {
  const Component = getIcon(name);
  const sizeClass = SIZE_CLASS[size];
  const combinedClassName = [sizeClass, ALIGNMENT_CLASS, className]
    .filter(Boolean)
    .join(" ");
  return (
    <Component
      className={combinedClassName}
      strokeWidth={strokeWidth}
      aria-hidden={ariaHidden}
      {...rest}
    />
  );
}

export type { SemanticIconKey };
export { getIcon } from "@/lib/iconRegistry";
