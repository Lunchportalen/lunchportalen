"use client";

import type { ReactNode } from "react";

/** Matches `app/driver/layout.tsx` chrome (no extra wrapper). */
export default function DriverLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
