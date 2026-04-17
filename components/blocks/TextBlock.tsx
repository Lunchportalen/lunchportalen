import React, { type ReactNode } from "react";

/**
 * CMS text primitive: no layout decisions — caller supplies typography classes.
 */
export function TextBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={className}>{children}</p>;
}
