import type { ReactNode } from "react";
import { spacing } from "@/lib/design/tokens";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type SectionProps = {
  children: ReactNode;
  className?: string;
  /** Vertical padding using design tokens. */
  padding?: keyof typeof spacing | "none";
  as?: "section" | "div";
};

export function Section({ children, className, padding = "lg", as = "section" }: SectionProps) {
  const py = padding === "none" ? "" : spacing[padding];
  const Tag = as;
  return <Tag className={cn(py, className)}>{children}</Tag>;
}
