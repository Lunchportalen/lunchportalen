import * as React from "react";

type BadgeVariant =
  | "basis"
  | "luxus"
  | "active"
  | "info"
  | "warning"
  | "danger"
  | "outline"
  | "default";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

const BASE = "lp-badge";

const VARIANT: Record<BadgeVariant, string> = {
  basis: "lp-badge--basis",
  luxus: "lp-badge--luxus",
  active: "lp-badge--active",
  info: "lp-badge--info",
  warning: "lp-badge--warning",
  danger: "lp-badge--danger",
  outline: "lp-badge--basis",
  default: "lp-badge--basis",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "basis", ...props }: BadgeProps) {
  return <div className={cn(BASE, VARIANT[variant], className)} {...props} />;
}
