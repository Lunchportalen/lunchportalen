"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type EditorSectionHeadingTone = "section" | "field";

/** Lokal presentasjon for detail-dokumentflaten — kun layout, ingen domene. */
export function EditorSection(
  props: {
    title: string;
    children: ReactNode;
    /** `field` = dokumentfelt-etikett (Umbraco-lignende), `section` = seksjonsoverskrift. */
    headingTone?: EditorSectionHeadingTone;
    bodyClassName?: string;
  } & Omit<ComponentPropsWithoutRef<"section">, "children">,
) {
  const { title, children, className, headingTone = "section", bodyClassName, ...rest } = props;
  const headingClass =
    headingTone === "field"
      ? "mb-2 text-sm font-medium text-slate-800"
      : "mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600";
  return (
    <section className={className} {...rest}>
      <h2 className={headingClass}>{title}</h2>
      <div className={bodyClassName ?? "space-y-4"}>{children}</div>
    </section>
  );
}
