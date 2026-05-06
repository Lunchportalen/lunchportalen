// app/superadmin/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import BlockedAccess from "@/components/auth/BlockedAccess";

import ControlTowerNav from "./_components/ControlTowerNav";

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
    <div className="min-h-screen overflow-x-hidden bg-[#f7f1e7] px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1500px] pt-[27px] pb-16">
        <div className="grid gap-3 rounded-[2rem] bg-[#f5ecdf] p-2 shadow-[0_24px_80px_rgba(35,28,18,0.08)] ring-1 ring-black/[0.04] lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-[1.65rem] bg-white/74 p-3 ring-1 ring-white/85 lg:sticky lg:top-6 lg:self-start">
            <ControlTowerNav />
          </aside>

          <main className="min-w-0 rounded-[1.75rem] bg-white/86 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
