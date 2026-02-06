// app/admin/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import AppHeader from "@/components/AppHeader";
import AdminFooter from "@/components/admin/AdminFooter";
import NeonGuard from "@/components/admin/NeonGuard";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================
   Helpers (låst)
========================= */
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

function normalizeRole(v: unknown): Role {
  const s = safeStr(v).toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  return "employee";
}

/**
 * NO DB role pre-check:
 * - email hard role
 * - then app_metadata.role
 * - then user_metadata.role
 *
 * NOTE:
 * - For company_admin we still verify profile row exists (fail-closed).
 */
function computeRoleNoDb(user: any): Role {
  const emailRole = roleByEmail(user?.email);
  if (emailRole) return emailRole;

  const appRole = normalizeRole(user?.app_metadata?.role);
  if (appRole !== "employee") return appRole;

  const metaRole = normalizeRole(user?.user_metadata?.role);
  return metaRole;
}

function homeForRole(role: Role) {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  return "/week";
}

function safeNextPath(next: string | null) {
  const FALLBACK = "/admin";
  if (!next) return FALLBACK;
  if (!next.startsWith("/")) return FALLBACK;
  if (next.startsWith("//")) return FALLBACK;

  // never loop focus flows from layout
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
    return FALLBACK;
  }
  return next;
}

async function currentPathFromHeaders(fallback: string) {
  try {
    const h = await headers();

    // best: middleware provides pathname
    const p = h.get("x-pathname");
    if (p) return safeNextPath(p);

    // next-url sometimes includes query
    const nextUrl = h.get("next-url");
    if (nextUrl) {
      try {
        if (nextUrl.startsWith("http")) return safeNextPath(new URL(nextUrl).pathname + new URL(nextUrl).search);
        return safeNextPath(nextUrl);
      } catch {
        return safeNextPath(nextUrl.split("?")[0] || fallback);
      }
    }

    // fallback variants
    const url = h.get("x-url") || h.get("x-forwarded-uri") || h.get("x-original-url") || "";
    if (url) {
      try {
        const u = url.startsWith("http") ? new URL(url) : new URL(url, "http://local");
        return safeNextPath(u.pathname + (u.search || ""));
      } catch {
        return safeNextPath(url.split("?")[0] || fallback);
      }
    }

    // last resort: referer
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
    // ignore
  }
  return fallback;
}

/* =========================
   Layout
========================= */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  // Ikke innlogget → login
  if (error || !user) {
    const next = encodeURIComponent(await currentPathFromHeaders("/admin"));
    redirect(`/login?next=${next}`);
  }

  const roleNoDb = computeRoleNoDb(user);

  // Kjøkken/driver skal aldri inn i admin
  if (roleNoDb === "kitchen" || roleNoDb === "driver") {
    redirect(homeForRole(roleNoDb));
  }

  /**
   * ✅ Enterprise-safe:
   * - superadmin: allow (no profile requirement here)
   * - company_admin: must have active profile row (fail-closed)
   * - others: redirect
   */
  if (roleNoDb === "superadmin") {
    return (
      <div className="min-h-screen bg-[rgb(var(--lp-bg))]">
        <AppHeader
          areaLabel="Admin"
          nav={[
            { label: "Dashboard", href: "/admin" },
            { label: "Avtale", href: "/admin/agreement" },
            { label: "Ordre", href: "/admin/orders" },
            { label: "Ansatte", href: "/admin/people" },
          ]}
        />
        <NeonGuard />
        {children}
        <AdminFooter />
      </div>
    );
  }

  if (roleNoDb !== "company_admin") {
    redirect(homeForRole(roleNoDb));
  }

  // company_admin -> verify profile row exists and is active (server truth)
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("role, disabled_at, is_active, company_id")
    .eq("user_id", user.id)
    .maybeSingle<{
      role: string | null;
      disabled_at: string | null;
      is_active: boolean | null;
      company_id: string | null;
    }>();

  // Fail-closed
  if (pErr || !profile) {
    const next = encodeURIComponent(await currentPathFromHeaders("/admin"));
    redirect(`/login?next=${next}`);
  }

  if (profile.disabled_at) redirect(homeForRole("employee"));
  if (profile.is_active === false) redirect(homeForRole("employee"));

  // Ensure role really is company_admin on server truth
  const role = normalizeRole(profile.role);
  if (role !== "company_admin") {
    redirect(homeForRole(role));
  }

  // Must have company_id to use admin (enterprise requirement)
  if (!profile.company_id) {
    // Send to week (or a dedicated blocked page if you have one)
    redirect("/week");
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--lp-bg))]">
      <AppHeader
        areaLabel="Admin"
        nav={[
          { label: "Dashboard", href: "/admin" },
          { label: "Avtale", href: "/admin/agreement" },
          { label: "Ordre", href: "/admin/orders" },
          { label: "Ansatte", href: "/admin/people" },
        ]}
      />
      <NeonGuard />
      {children}
      <AdminFooter />
    </div>
  );
}
