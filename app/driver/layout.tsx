// app/driver/layout.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

function normalizeRole(v: unknown): Role {
  const s = safeStr(v).toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin")
    return "company_admin";
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen" || s === "kjokken") return "kitchen";
  if (s === "driver" || s === "sjafor") return "driver";
  return "employee";
}

function computeRoleNoDb(user: any): Role {
  // 1) Hard systemkonto via email
  const emailRole = roleByEmail(user?.email);
  if (emailRole) return emailRole;

  // 2) app_metadata (noen prosjekter legger rolle her)
  const appRole = normalizeRole(user?.app_metadata?.role);
  if (appRole !== "employee") return appRole;

  // 3) user_metadata fallback
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

async function currentPathFromHeaders(fallback: string) {
  try {
    const h = await headers();

    // Vercel/Next kan sende forskjellige hints; vi prøver flere, fail-soft
    const url =
      h.get("x-url") ||
      h.get("x-forwarded-uri") ||
      h.get("x-original-url") ||
      h.get("referer") ||
      "";

    if (url) {
      // url kan være absolut eller path
      const u = url.startsWith("http") ? new URL(url) : new URL(url, "http://local");
      return u.pathname + (u.search || "");
    }
  } catch {
    // no-op
  }
  return fallback;
}

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    const next = encodeURIComponent(await currentPathFromHeaders("/driver"));
    redirect(`/login?next=${next}`);
  }

  // ⚠️ Layout er "no-db". Rollen bestemmes uten profiles-oppslag.
  // All streng gating ligger også i /driver/page.tsx (fail-closed).
  const role = computeRoleNoDb(user);

  // Driver + Superadmin har tilgang
  if (role !== "driver" && role !== "superadmin") {
    redirect(homeForRole(role));
  }

  return <>{children}</>;
}
