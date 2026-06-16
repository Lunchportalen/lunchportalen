// app/superadmin/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import BlockedAccess from "@/components/auth/BlockedAccess";

import ControlTowerNav from "./_components/ControlTowerNav";
import "@/app/styles/ds/superadmin-shell.css";

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
    <div className="lp-app-shell">
      <div className="lp-app-shell__inner">
        <div className="lp-app-shell__frame">
          <aside className="lp-app-shell__sidebar">
            <ControlTowerNav />
          </aside>

          <main className="lp-app-shell__main">{children}</main>
        </div>
      </div>
    </div>
  );
}
