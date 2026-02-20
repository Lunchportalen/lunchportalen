// app/(portal)/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import PortalProviders from "@/components/providers/PortalProviders";
import BlockedAccess from "@/components/auth/BlockedAccess";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { roleHome } from "@/lib/auth/roleHome";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNextPath(p: string | null | undefined) {
  const v = safeStr(p);
  if (!v) return "/week";
  if (!v.startsWith("/")) return "/week";
  if (v.startsWith("//")) return "/week";
  if (v.includes("\n") || v.includes("\r")) return "/week";
  return v;
}

function isPortalRole(role: string) {
  return role === "employee" || role === "company_admin";
}

async function getNextFromHeaders() {
  const h = await headers();
  const candidates = [h.get("x-pathname"), h.get("next-url"), h.get("x-next-url"), h.get("x-invoke-path"), h.get("referer")].filter(
    Boolean
  ) as string[];

  for (const c of candidates) {
    const v = safeStr(c);
    if (v.startsWith("http://") || v.startsWith("https://")) {
      try {
        const u = new URL(v);
        return safeNextPath(u.pathname + (u.search ?? ""));
      } catch {
        continue;
      }
    }
    if (v.startsWith("/")) return safeNextPath(v);
  }

  return "/week";
}

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      const nextPath = await getNextFromHeaders();
      redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    }
    return <BlockedAccess reason={auth.reason} />;
  }

  const role = auth.role;
  if (!role) {
    return <BlockedAccess reason="BLOCKED" />;
  }

  if (!isPortalRole(role)) {
    redirect(roleHome(role));
  }

  return (
    <PortalProviders>
      <main className="min-h-[100svh] w-full lp-page">
        <div className="mx-auto w-full max-w-[1100px] px-4 pb-10 pt-4 md:px-6 md:pt-6">{children}</div>
      </main>
    </PortalProviders>
  );
}
