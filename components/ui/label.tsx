// components/ui/label.tsx
"use client";

import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-sm font-medium",
        "text-[color:var(--lp-fg)]",
        className
      )}
      {...props}
    />
  );
}
