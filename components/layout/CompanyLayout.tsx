"use client";

import type { ReactNode } from "react";

import AdminFooter from "@/components/admin/AdminFooter";
import NeonGuard from "@/components/admin/NeonGuard";

/** Client twin of `app/admin/layout.tsx` inner shell (NeonGuard + main + admin footer). */
export default function CompanyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full">
      <NeonGuard />
      <main className="w-full">{children}</main>
      <AdminFooter />
    </div>
  );
}
