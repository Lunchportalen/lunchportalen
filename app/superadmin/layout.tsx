// app/superadmin/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import BlockedAccess from "@/components/auth/BlockedAccess";

import ControlHeader from "./_components/ControlHeader";
import ControlTowerNav from "./_components/ControlTowerNav";
import DemoStory from "./_components/DemoStory";
import DemoToggle from "./_components/DemoToggle";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { roleHome } from "@/lib/auth/roleHome";

async function currentPathFromHeaders() {
  try {
    const h = await headers();
    const url = h.get("x-url") || h.get("next-url") || h.get("referer") || "";
    if (url) {
      const u = new URL(url);
      const path = (u.pathname || "/superadmin") + (u.search || "");
      return path.startsWith("/superadmin") ? path : "/superadmin";
    }
  } catch {
    return "/superadmin";
  }

  return "/superadmin";
}

export default async function SuperadminLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      const next = encodeURIComponent(await currentPathFromHeaders());
      redirect(`/login?next=${next}`);
    }
    return <BlockedAccess reason={auth.reason} />;
  }

  if (auth.role !== "superadmin") {
    redirect(roleHome(auth.role));
  }

  return (
    <div className="min-h-[calc(100vh-0px)] bg-[rgb(var(--lp-bg))]" style={{ padding: 20 }}>
      <div className="mx-auto max-w-7xl px-4 pt-[27px] pb-16">
        <div className="lp-glass-card lp-superadmin-motion-shell rounded-card p-4 sm:p-6">
          <ControlHeader />
          <ControlTowerNav />
          {children}
        </div>
      </div>
      <DemoStory />
      <DemoToggle />
    </div>
  );
}
