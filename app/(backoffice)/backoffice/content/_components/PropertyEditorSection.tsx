"use client";

import type { ReactNode } from "react";

/** Mirrors Umbraco-style property editor grouping: innhold vs presentasjon vs struktur. */
export type PropertyEditorSectionKind = "content" | "settings" | "structure";

export function PropertyEditorSection(props: {
  section: PropertyEditorSectionKind;
  /** Short uppercase-style label (Norwegian). */
  overline: string;
  children: ReactNode;
  className?: string;
}) {
  const { section, overline, children, className = "" } = props;
  return (
    <section
      className={`rounded-lg border border-[rgb(var(--lp-border))]/70 bg-white/90 pl-2.5 pr-2 py-2 shadow-[inset_3px_0_0_rgba(236,72,153,0.42)] ${className}`}
      data-lp-property-section={section}
    >
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-pink-900/55">{overline}</p>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}
