"use client";

import type { ReactNode } from "react";

/** Matches `app/kitchen/layout.tsx` chrome (no extra wrapper). */
export default function KitchenLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
