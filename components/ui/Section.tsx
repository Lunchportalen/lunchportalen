import React, { type ReactNode } from "react";

/**
 * CMS marketing shell: section + inner container (locked rhythm).
 * Use with `marketingSectionClassString` / `marketingContainerClassString` from the design contract.
 */
export function Section({
  sectionClassName,
  containerClassName,
  children,
  "aria-label": ariaLabel,
}: {
  sectionClassName: string;
  containerClassName: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <section className={sectionClassName} {...(ariaLabel ? { "aria-label": ariaLabel } : {})}>
      <div className={containerClassName}>{children}</div>
    </section>
  );
}
