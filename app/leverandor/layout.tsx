// app/leverandor/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import "@/app/styles/ds/provider-admin.css";

import ProviderNav from "@/components/providers/ProviderNav";
import SuspendedBanner from "@/components/providers/SuspendedBanner";
import { canAccessProvider } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { roleHome } from "@/lib/auth/roleHome";

function safeNextPath(next: string | null) {
  const fallback = "/leverandor";
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.startsWith("/login")) return fallback;
  return next;
}

async function currentPathFromHeaders(fallback: string) {
  try {
    const h = await headers();
    const p = h.get("x-pathname");
    if (p) return safeNextPath(p);
    const nextUrl = h.get("next-url");
    if (nextUrl) {
      try {
        const u = nextUrl.startsWith("http") ? new URL(nextUrl) : new URL(nextUrl, "http://local");
        return safeNextPath(u.pathname + (u.search || ""));
      } catch {
        return safeNextPath(nextUrl.split("?")[0] || fallback);
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export default async function LeverandorLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      const next = encodeURIComponent(await currentPathFromHeaders("/leverandor"));
      redirect(`/login?next=${next}`);
    }
    redirect("/login?code=NO_SESSION");
  }

  const userId = String(auth.user?.id ?? "").trim();
  if (!userId) redirect("/login?code=NO_SESSION");

  const ctx = await getProviderAdminContext(userId);

  if (!ctx.memberships.length) {
    if (auth.role === "superadmin") redirect("/superadmin");
    redirect(roleHome(auth.role ?? "employee"));
  }

  const provider = ctx.primaryProvider;
  if (!provider) redirect(roleHome(auth.role ?? "employee"));

  const allowed = await canAccessProvider(userId, provider.id);
  if (!allowed) redirect(roleHome(auth.role ?? "employee"));

  const kitchenOnly =
    ctx.role === "provider_kitchen" && !ctx.memberships.some((m) => m.role === "provider_admin");

  return (
    <div className="ds-admin-root ds-provider-root">
      <ProviderNav
        providerName={provider.name}
        logoUrl={provider.logoUrl}
        userEmail={ctx.user.email}
        userRole={ctx.role}
        kitchenOnly={kitchenOnly}
        providerAdmin={ctx.role === "provider_admin"}
      />
      <div className="ds-admin-main">
        <main className="ds-admin-content ds-page">
          <SuspendedBanner provider={provider} />
          {children}
        </main>
      </div>
    </div>
  );
}
