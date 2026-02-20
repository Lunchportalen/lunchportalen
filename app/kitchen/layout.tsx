// app/kitchen/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import BlockedAccess from "@/components/auth/BlockedAccess";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { roleHome } from "@/lib/auth/roleHome";

async function currentPathFromHeaders(fallback: string) {
  try {
    const h = await headers();
    const url = h.get("x-url") || h.get("referer") || "";
    if (url) {
      const u = new URL(url);
      return u.pathname + (u.search || "");
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export default async function KitchenLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      const next = encodeURIComponent(await currentPathFromHeaders("/kitchen"));
      redirect(`/login?next=${next}`);
    }
    return <BlockedAccess reason={auth.reason} />;
  }

  if (auth.role !== "kitchen" && auth.role !== "superadmin") {
    redirect(roleHome(auth.role));
  }

  return <>{children}</>;
}
