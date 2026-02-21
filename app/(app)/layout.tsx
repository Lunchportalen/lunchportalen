export const dynamic = "force-dynamic";

import type { ReactNode } from "react";

import AppFooter from "@/components/AppFooter";
import HeaderShell from "@/components/nav/HeaderShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lp-page">
      <HeaderShell />

      <main className="lp-main">
        <div className="w-full">{children}</div>
      </main>

      <AppFooter containerMode="full" />
    </div>
  );
}
