"use client";

import type { ReactNode } from "react";

/** Client twin of `app/superadmin/layout.tsx` inner shell (card container). */
export default function SuperadminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-0px)] bg-[rgb(var(--lp-bg))]">
      <div className="mx-auto max-w-7xl px-4 pt-[27px] pb-16">
        <div className="lp-glass-card rounded-card p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
