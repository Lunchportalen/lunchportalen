// app/admin/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AdminFooter from "@/components/admin/AdminFooter";
import NeonGuard from "@/components/admin/NeonGuard";
import BlockedAccess from "@/components/auth/BlockedAccess";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { roleHome } from "@/lib/auth/roleHome";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNextPath(next: string | null) {
  const fallback = "/admin";
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;

  if (
    next === "/login" ||
    next.startsWith("/login/") ||
    next === "/register" ||
    next.startsWith("/register/") ||
    next === "/forgot-password" ||
    next.startsWith("/forgot-password/") ||
    next === "/reset-password" ||
    next.startsWith("/reset-password/")
  ) {
    return fallback;
  }

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
        if (nextUrl.startsWith("http")) {
          const u = new URL(nextUrl);
          return safeNextPath(u.pathname + (u.search || ""));
        }
        return safeNextPath(nextUrl);
      } catch {
        return safeNextPath(nextUrl.split("?")[0] || fallback);
      }
    }

    const url = h.get("x-url") || h.get("x-forwarded-uri") || h.get("x-original-url") || "";
    if (url) {
      try {
        const u = url.startsWith("http") ? new URL(url) : new URL(url, "http://local");
        return safeNextPath(u.pathname + (u.search || ""));
      } catch {
        return safeNextPath(url.split("?")[0] || fallback);
      }
    }

    const ref = h.get("referer");
    if (ref) {
      try {
        const u = new URL(ref);
        return safeNextPath(u.pathname + (u.search || ""));
      } catch {
        return fallback;
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function shell(children: ReactNode) {
  return (
    <div className="w-full">
      <NeonGuard />
      <main className="w-full">{children}</main>
      <AdminFooter />
    </div>
  );
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      const next = encodeURIComponent(await currentPathFromHeaders("/admin"));
      redirect(`/login?next=${next}`);
    }
    return <BlockedAccess reason={auth.reason} />;
  }

  const role = safeStr(auth.role);
  if (!role) {
    return <BlockedAccess reason="BLOCKED" />;
  }

  if (role === "superadmin") {
    return shell(children);
  }

  if (role !== "company_admin") {
    redirect(roleHome(role));
  }

  if (!auth.company_id) {
    return <BlockedAccess reason="BLOCKED" />;
  }

  return shell(children);
}
