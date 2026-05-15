// app/admin/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AdminMobileNav from "./AdminMobileNav";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import BlockedAccess from "@/components/auth/BlockedAccess";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { roleHome } from "@/lib/auth/roleHome";
import { supabaseServer } from "@/lib/supabase/server";

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

function titleForAdminPath(path: string) {
  const pathname = safeNextPath(path).split("?")[0] || "/admin";
  if (pathname.includes("/admin/company/") && pathname.includes("/dashboard")) {
    return "Firmadashbord";
  }
  const items: Array<{ href: string; title: string; exact?: boolean }> = [
    { href: "/admin", title: "Oversikt", exact: true },
    { href: "/admin/dagens-brukere", title: "Dagens drift" },
    { href: "/admin/dagens-levering", title: "Dagens levering" },
    { href: "/admin/uke-bestillbarhet", title: "Uke og bestilling" },
    { href: "/admin/people", title: "Ansatte" },
    { href: "/admin/locations", title: "Lokasjoner" },
    { href: "/admin/agreement", title: "Avtale og drift" },
    { href: "/admin/leveringsgrunnlag", title: "Leveringsgrunnlag" },
    { href: "/admin/insights", title: "Økonomi" },
    { href: "/admin/orders", title: "Historikk" },
    { href: "/admin/history", title: "Aktivitet" },
    { href: "/admin/control-tower", title: "Kontrolltårn" },
    { href: "/admin/invite", title: "Inviter ansatte" },
  ];
  const match = items.find((item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)));
  return match?.title ?? "Admin";
}

async function loadCompanyName(companyId: string) {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.from("companies").select("name").eq("id", companyId).maybeSingle();
    if (error) return "Firma";
    return safeStr(data?.name) || "Firma";
  } catch {
    return "Firma";
  }
}

async function shell(
  children: ReactNode,
  opts?: {
    showCompanyAdminNav?: boolean;
    companyName?: string;
    userName?: string;
    pageTitle?: string;
    companyId?: string | null;
  },
) {
  const showNav = opts?.showCompanyAdminNav !== false;
  return (
    <div className="ds-admin-root">
      {showNav ? (
        <AdminSidebar companyName={opts?.companyName ?? "Firma"} userName={opts?.userName ?? "Firmaadmin"} companyId={opts?.companyId ?? null} />
      ) : null}
      <div className="ds-admin-main">
        <AdminTopbar pageTitle={opts?.pageTitle ?? "Oversikt"} />
        <main className="ds-admin-content">{children}</main>
      </div>
      {showNav ? (
        <AdminMobileNav companyDashboardHref={opts?.companyId ? `/admin/company/${opts.companyId}/dashboard` : null} />
      ) : null}
    </div>
  );
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      // No `next` here: /admin failing auth must not bounce back through
      // /login → /admin → /login. `code` tells /login to stay on the form.
      redirect("/login?code=NO_SESSION");
    }
    return <BlockedAccess reason={auth.reason} />;
  }

  const role = safeStr(auth.role);
  if (!role) {
    return <BlockedAccess reason="BLOCKED" />;
  }

  const currentPath = await currentPathFromHeaders("/admin");
  const pageTitle = titleForAdminPath(currentPath);

  if (role === "superadmin") {
    return shell(children, { showCompanyAdminNav: false, pageTitle });
  }

  if (role !== "company_admin") {
    redirect(roleHome(role));
  }

  if (!auth.company_id) {
    return <BlockedAccess reason="BLOCKED" />;
  }

  if (!(await hasActiveAgreement(auth.company_id))) {
    redirect("/avtale-ikke-aktiv");
  }

  const companyName = await loadCompanyName(auth.company_id);
  const userName =
    safeStr((auth as any).user?.user_metadata?.full_name) ||
    safeStr((auth as any).user?.email) ||
    safeStr((auth as any).email) ||
    "Firmaadmin";

  return shell(children, { companyName, userName, pageTitle, companyId: auth.company_id });
}

async function hasActiveAgreement(companyId: string): Promise<boolean> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("agreements")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();
    if (error) return false;
    return Boolean(data?.id);
  } catch {
    return false;
  }
}
