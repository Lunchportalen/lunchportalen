// app/driver/layout.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import BlockedAccess from "@/components/auth/BlockedAccess";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { roleHome } from "@/lib/auth/roleHome";

async function currentPathFromHeaders(fallback: string) {
  try {
    const h = await headers();
    const url = h.get("x-url") || h.get("x-forwarded-uri") || h.get("x-original-url") || h.get("referer") || "";

    if (url) {
      const u = url.startsWith("http") ? new URL(url) : new URL(url, "http://local");
      return u.pathname + (u.search || "");
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      const next = encodeURIComponent(await currentPathFromHeaders("/driver"));
      redirect(`/login?next=${next}`);
    }
    return <BlockedAccess reason={auth.reason} />;
  }

  if (auth.role !== "driver" && auth.role !== "superadmin") {
    redirect(roleHome(auth.role));
  }

  return <>{children}</>;
}
